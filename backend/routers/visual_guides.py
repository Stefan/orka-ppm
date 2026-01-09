"""
Visual Guides API Router
Provides endpoints for managing visual guides and screenshots
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..config.database import get_db
from ..auth.dependencies import get_current_user
from ..services.visual_guide_service import visual_guide_service, VisualGuide
from ..models.users import User

router = APIRouter(prefix="/visual-guides", tags=["visual-guides"])


# Request/Response Models
class ScreenshotAnnotationRequest(BaseModel):
    id: str
    type: str = Field(..., regex="^(arrow|callout|highlight|click|text)$")
    position: Dict[str, float]
    size: Optional[Dict[str, float]] = None
    content: Optional[str] = None
    direction: Optional[str] = Field(None, regex="^(up|down|left|right)$")
    color: Optional[str] = "#3B82F6"
    style: Optional[str] = Field("solid", regex="^(solid|dashed|dotted)$")


class VisualGuideStepRequest(BaseModel):
    title: str
    description: str
    screenshot: Optional[str] = None
    annotations: List[ScreenshotAnnotationRequest] = []
    target_element: Optional[str] = None
    action: Optional[str] = Field(None, regex="^(click|type|hover|scroll|wait)$")
    action_data: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None
    is_optional: bool = False


class CreateVisualGuideRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    category: str = Field(..., regex="^(feature|workflow|troubleshooting|onboarding)$")
    difficulty: str = Field(..., regex="^(beginner|intermediate|advanced)$")
    estimated_time: int = Field(..., ge=1, le=120)  # 1-120 minutes
    steps: List[VisualGuideStepRequest]
    tags: List[str] = []
    prerequisites: List[str] = []


class UpdateVisualGuideRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    category: Optional[str] = Field(None, regex="^(feature|workflow|troubleshooting|onboarding)$")
    difficulty: Optional[str] = Field(None, regex="^(beginner|intermediate|advanced)$")
    estimated_time: Optional[int] = Field(None, ge=1, le=120)
    steps: Optional[List[VisualGuideStepRequest]] = None
    tags: Optional[List[str]] = None
    prerequisites: Optional[List[str]] = None


class VisualGuideResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    difficulty: str
    estimated_time: int
    steps: List[Dict[str, Any]]
    tags: List[str]
    prerequisites: List[str]
    version: str
    last_updated: str
    is_outdated: bool
    usage_count: int
    completion_rate: float

    class Config:
        from_attributes = True


class GuideRecommendationResponse(BaseModel):
    guide: VisualGuideResponse
    relevance_score: float
    reason: str


class ScreenshotUploadRequest(BaseModel):
    screenshot_data: str = Field(..., description="Base64 encoded screenshot data")
    metadata: Optional[Dict[str, Any]] = None


class GuideValidationResponse(BaseModel):
    valid: bool
    confidence: float
    issues: List[str]
    age_days: int
    missing_screenshots: int


class CompletionTrackingRequest(BaseModel):
    completed_steps: List[str]
    completion_time: float  # Time in seconds


# API Endpoints

@router.post("/", response_model=VisualGuideResponse)
async def create_visual_guide(
    request: CreateVisualGuideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new visual guide"""
    
    try:
        # Convert request to service format
        steps_data = []
        for step in request.steps:
            step_data = {
                "title": step.title,
                "description": step.description,
                "screenshot": step.screenshot,
                "annotations": [ann.dict() for ann in step.annotations],
                "target_element": step.target_element,
                "action": step.action,
                "action_data": step.action_data,
                "duration": step.duration,
                "is_optional": step.is_optional
            }
            steps_data.append(step_data)
        
        guide = await visual_guide_service.create_visual_guide(
            title=request.title,
            description=request.description,
            category=request.category,
            difficulty=request.difficulty,
            estimated_time=request.estimated_time,
            steps=steps_data,
            tags=request.tags,
            prerequisites=request.prerequisites,
            created_by=str(current_user.id),
            db=db
        )
        
        return _guide_to_response(guide)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create visual guide: {str(e)}")


@router.get("/", response_model=List[VisualGuideResponse])
async def list_visual_guides(
    category: Optional[str] = Query(None, regex="^(feature|workflow|troubleshooting|onboarding)$"),
    difficulty: Optional[str] = Query(None, regex="^(beginner|intermediate|advanced)$"),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags"),
    search: Optional[str] = Query(None, description="Search query"),
    include_outdated: bool = Query(False, description="Include outdated guides"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List visual guides with filtering"""
    
    try:
        # Parse tags
        tag_list = tags.split(',') if tags else None
        
        guides = await visual_guide_service.list_visual_guides(
            category=category,
            difficulty=difficulty,
            tags=tag_list,
            search_query=search,
            include_outdated=include_outdated,
            limit=limit,
            offset=offset,
            db=db
        )
        
        return [_guide_to_response(guide) for guide in guides]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list visual guides: {str(e)}")


@router.get("/{guide_id}", response_model=VisualGuideResponse)
async def get_visual_guide(
    guide_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific visual guide"""
    
    guide = await visual_guide_service.get_visual_guide(guide_id, db)
    if not guide:
        raise HTTPException(status_code=404, detail="Visual guide not found")
    
    return _guide_to_response(guide)


@router.put("/{guide_id}", response_model=VisualGuideResponse)
async def update_visual_guide(
    guide_id: str,
    request: UpdateVisualGuideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a visual guide"""
    
    try:
        # Convert request to updates dict
        updates = {}
        if request.title is not None:
            updates["title"] = request.title
        if request.description is not None:
            updates["description"] = request.description
        if request.category is not None:
            updates["category"] = request.category
        if request.difficulty is not None:
            updates["difficulty"] = request.difficulty
        if request.estimated_time is not None:
            updates["estimated_time"] = request.estimated_time
        if request.tags is not None:
            updates["tags"] = request.tags
        if request.prerequisites is not None:
            updates["prerequisites"] = request.prerequisites
        
        if request.steps is not None:
            steps_data = []
            for step in request.steps:
                step_data = {
                    "title": step.title,
                    "description": step.description,
                    "screenshot": step.screenshot,
                    "annotations": [ann.dict() for ann in step.annotations],
                    "target_element": step.target_element,
                    "action": step.action,
                    "action_data": step.action_data,
                    "duration": step.duration,
                    "is_optional": step.is_optional
                }
                steps_data.append(step_data)
            updates["steps"] = steps_data
        
        guide = await visual_guide_service.update_visual_guide(guide_id, updates, db)
        if not guide:
            raise HTTPException(status_code=404, detail="Visual guide not found")
        
        return _guide_to_response(guide)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update visual guide: {str(e)}")


@router.delete("/{guide_id}")
async def delete_visual_guide(
    guide_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a visual guide"""
    
    success = await visual_guide_service.delete_visual_guide(guide_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Visual guide not found")
    
    return {"message": "Visual guide deleted successfully"}


@router.post("/{guide_id}/steps/{step_id}/screenshot")
async def upload_screenshot(
    guide_id: str,
    step_id: str,
    request: ScreenshotUploadRequest,
    current_user: User = Depends(get_current_user)
):
    """Upload a screenshot for a guide step"""
    
    try:
        screenshot_url = await visual_guide_service.save_screenshot(
            guide_id=guide_id,
            step_id=step_id,
            screenshot_data=request.screenshot_data,
            metadata=request.metadata
        )
        
        return {"screenshot_url": screenshot_url}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload screenshot: {str(e)}")


@router.get("/{guide_id}/validate", response_model=GuideValidationResponse)
async def validate_guide_freshness(
    guide_id: str,
    max_age_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Validate if a guide's screenshots are still fresh"""
    
    validation_result = await visual_guide_service.validate_guide_freshness(
        guide_id, max_age_days
    )
    
    return GuideValidationResponse(**validation_result)


@router.get("/recommendations/context", response_model=List[GuideRecommendationResponse])
async def get_guide_recommendations(
    route: str = Query(..., description="Current page route"),
    page_title: str = Query(..., description="Current page title"),
    user_role: str = Query(..., description="User role"),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get guide recommendations based on current context"""
    
    try:
        context = {
            "route": route,
            "page_title": page_title,
            "user_role": user_role
        }
        
        recommendations = await visual_guide_service.get_guide_recommendations(
            context, limit, db
        )
        
        return [
            GuideRecommendationResponse(
                guide=_guide_to_response(rec["guide"]),
                relevance_score=rec["relevance_score"],
                reason=rec["reason"]
            )
            for rec in recommendations
        ]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


@router.post("/{guide_id}/completion")
async def track_guide_completion(
    guide_id: str,
    request: CompletionTrackingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Track guide completion for analytics"""
    
    try:
        success = await visual_guide_service.track_guide_completion(
            guide_id=guide_id,
            user_id=str(current_user.id),
            completed_steps=request.completed_steps,
            completion_time=request.completion_time,
            db=db
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to track completion")
        
        return {"message": "Completion tracked successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track completion: {str(e)}")


@router.post("/{guide_id}/refresh")
async def refresh_guide_screenshots(
    guide_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh all screenshots for a guide (mark for regeneration)"""
    
    try:
        # Mark guide as needing refresh
        updates = {
            "is_outdated": False,  # Reset outdated flag
            "last_updated": None   # Will be set to current time
        }
        
        guide = await visual_guide_service.update_visual_guide(guide_id, updates, db)
        if not guide:
            raise HTTPException(status_code=404, detail="Visual guide not found")
        
        return {"message": "Guide marked for screenshot refresh"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh guide: {str(e)}")


# Helper functions

def _guide_to_response(guide: VisualGuide) -> VisualGuideResponse:
    """Convert VisualGuide to response model"""
    
    # Convert steps to dict format
    steps_data = []
    for step in guide.steps:
        step_data = {
            "id": step.id,
            "title": step.title,
            "description": step.description,
            "screenshot": step.screenshot,
            "annotations": [
                {
                    "id": ann.id,
                    "type": ann.type,
                    "position": ann.position,
                    "size": ann.size,
                    "content": ann.content,
                    "direction": ann.direction,
                    "color": ann.color,
                    "style": ann.style
                }
                for ann in step.annotations
            ],
            "target_element": step.target_element,
            "action": step.action,
            "action_data": step.action_data,
            "duration": step.duration,
            "is_optional": step.is_optional
        }
        steps_data.append(step_data)
    
    return VisualGuideResponse(
        id=guide.id,
        title=guide.title,
        description=guide.description,
        category=guide.category,
        difficulty=guide.difficulty,
        estimated_time=guide.estimated_time,
        steps=steps_data,
        tags=guide.tags,
        prerequisites=guide.prerequisites,
        version=guide.version,
        last_updated=guide.last_updated.isoformat(),
        is_outdated=guide.is_outdated,
        usage_count=guide.usage_count,
        completion_rate=guide.completion_rate
    )