"""
Visual Guide Service
Manages visual guides, screenshots, and step-by-step instructions for the help system
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import base64
import hashlib

from fastapi import HTTPException, UploadFile
import asyncio
import aiofiles

from config.database import get_db
from models.help_content import HelpContent


@dataclass
class ScreenshotAnnotation:
    """Screenshot annotation data structure"""
    id: str
    type: str  # 'arrow', 'callout', 'highlight', 'click', 'text'
    position: Dict[str, float]  # {'x': float, 'y': float}
    size: Optional[Dict[str, float]] = None  # {'width': float, 'height': float}
    content: Optional[str] = None
    direction: Optional[str] = None  # 'up', 'down', 'left', 'right'
    color: Optional[str] = None
    style: Optional[str] = None  # 'solid', 'dashed', 'dotted'


@dataclass
class VisualGuideStep:
    """Visual guide step data structure"""
    id: str
    title: str
    description: str
    screenshot: Optional[str] = None
    annotations: List[ScreenshotAnnotation] = None
    target_element: Optional[str] = None
    action: Optional[str] = None  # 'click', 'type', 'hover', 'scroll', 'wait'
    action_data: Optional[Dict[str, Any]] = None
    duration: Optional[float] = None
    is_optional: bool = False

    def __post_init__(self):
        if self.annotations is None:
            self.annotations = []


@dataclass
class VisualGuide:
    """Visual guide data structure"""
    id: str
    title: str
    description: str
    category: str  # 'feature', 'workflow', 'troubleshooting', 'onboarding'
    difficulty: str  # 'beginner', 'intermediate', 'advanced'
    estimated_time: int
    steps: List[VisualGuideStep]
    prerequisites: List[str] = None
    tags: List[str] = None
    version: str = "1.0.0"
    last_updated: datetime = None
    is_outdated: bool = False
    created_by: Optional[str] = None
    usage_count: int = 0
    completion_rate: float = 0.0

    def __post_init__(self):
        if self.prerequisites is None:
            self.prerequisites = []
        if self.tags is None:
            self.tags = []
        if self.last_updated is None:
            self.last_updated = datetime.utcnow()


class VisualGuideService:
    """Service for managing visual guides and screenshots"""

    def __init__(self, storage_path: str = "storage/visual_guides"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Screenshot storage
        self.screenshot_path = self.storage_path / "screenshots"
        self.screenshot_path.mkdir(exist_ok=True)
        
        # Guide storage
        self.guide_path = self.storage_path / "guides"
        self.guide_path.mkdir(exist_ok=True)

    async def create_visual_guide(
        self,
        title: str,
        description: str,
        category: str,
        difficulty: str,
        estimated_time: int,
        steps: List[Dict[str, Any]],
        tags: List[str] = None,
        prerequisites: List[str] = None,
        created_by: str = None,
        db = None
    ) -> VisualGuide:
        """Create a new visual guide"""
        
        guide_id = str(uuid.uuid4())
        
        # Process steps
        processed_steps = []
        for i, step_data in enumerate(steps):
            step_id = f"step-{i+1}-{int(datetime.utcnow().timestamp())}"
            
            # Process annotations
            annotations = []
            if 'annotations' in step_data:
                for ann_data in step_data['annotations']:
                    annotation = ScreenshotAnnotation(
                        id=ann_data.get('id', f"ann-{len(annotations)}"),
                        type=ann_data.get('type', 'highlight'),
                        position=ann_data.get('position', {'x': 50, 'y': 50}),
                        size=ann_data.get('size'),
                        content=ann_data.get('content'),
                        direction=ann_data.get('direction'),
                        color=ann_data.get('color', '#3B82F6'),
                        style=ann_data.get('style', 'solid')
                    )
                    annotations.append(annotation)
            
            step = VisualGuideStep(
                id=step_id,
                title=step_data.get('title', f'Step {i+1}'),
                description=step_data.get('description', ''),
                screenshot=step_data.get('screenshot'),
                annotations=annotations,
                target_element=step_data.get('target_element'),
                action=step_data.get('action'),
                action_data=step_data.get('action_data'),
                duration=step_data.get('duration'),
                is_optional=step_data.get('is_optional', False)
            )
            processed_steps.append(step)
        
        # Create guide
        guide = VisualGuide(
            id=guide_id,
            title=title,
            description=description,
            category=category,
            difficulty=difficulty,
            estimated_time=estimated_time,
            steps=processed_steps,
            tags=tags or [],
            prerequisites=prerequisites or [],
            created_by=created_by
        )
        
        # Save to file system
        await self._save_guide_to_file(guide)
        
        # Save metadata to database
        if db:
            await self._save_guide_to_db(guide, db)
        
        return guide

    async def get_visual_guide(self, guide_id: str, db = None) -> Optional[VisualGuide]:
        """Get a visual guide by ID"""
        
        guide_file = self.guide_path / f"{guide_id}.json"
        if not guide_file.exists():
            return None
        
        try:
            async with aiofiles.open(guide_file, 'r') as f:
                guide_data = json.loads(await f.read())
            
            # Convert to VisualGuide object
            guide = self._dict_to_guide(guide_data)
            
            # Update usage count
            if db:
                await self._increment_usage_count(guide_id, db)
            
            return guide
        except Exception as e:
            print(f"Error loading guide {guide_id}: {e}")
            return None

    async def list_visual_guides(
        self,
        category: str = None,
        difficulty: str = None,
        tags: List[str] = None,
        search_query: str = None,
        include_outdated: bool = False,
        limit: int = 50,
        offset: int = 0,
        db = None
    ) -> List[VisualGuide]:
        """List visual guides with filtering"""
        
        guides = []
        
        # Load all guide files
        for guide_file in self.guide_path.glob("*.json"):
            try:
                async with aiofiles.open(guide_file, 'r') as f:
                    guide_data = json.loads(await f.read())
                
                guide = self._dict_to_guide(guide_data)
                
                # Apply filters
                if not self._matches_filters(guide, category, difficulty, tags, search_query, include_outdated):
                    continue
                
                guides.append(guide)
            except Exception as e:
                print(f"Error loading guide from {guide_file}: {e}")
                continue
        
        # Sort by last updated (newest first)
        guides.sort(key=lambda g: g.last_updated, reverse=True)
        
        # Apply pagination
        return guides[offset:offset + limit]

    async def update_visual_guide(
        self,
        guide_id: str,
        updates: Dict[str, Any],
        db = None
    ) -> Optional[VisualGuide]:
        """Update a visual guide"""
        
        guide = await self.get_visual_guide(guide_id, db)
        if not guide:
            return None
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(guide, key):
                setattr(guide, key, value)
        
        # Update timestamp
        guide.last_updated = datetime.utcnow()
        
        # Save updated guide
        await self._save_guide_to_file(guide)
        
        if db:
            await self._update_guide_in_db(guide, db)
        
        return guide

    async def delete_visual_guide(self, guide_id: str, db = None) -> bool:
        """Delete a visual guide"""
        
        guide_file = self.guide_path / f"{guide_id}.json"
        if not guide_file.exists():
            return False
        
        try:
            # Delete guide file
            guide_file.unlink()
            
            # Delete associated screenshots
            screenshot_dir = self.screenshot_path / guide_id
            if screenshot_dir.exists():
                import shutil
                shutil.rmtree(screenshot_dir)
            
            # Delete from database
            if db:
                await self._delete_guide_from_db(guide_id, db)
            
            return True
        except Exception as e:
            print(f"Error deleting guide {guide_id}: {e}")
            return False

    async def save_screenshot(
        self,
        guide_id: str,
        step_id: str,
        screenshot_data: str,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Save a screenshot for a guide step"""
        
        # Create guide screenshot directory
        guide_screenshot_dir = self.screenshot_path / guide_id
        guide_screenshot_dir.mkdir(exist_ok=True)
        
        # Generate filename
        timestamp = int(datetime.utcnow().timestamp())
        filename = f"{step_id}_{timestamp}.png"
        screenshot_path = guide_screenshot_dir / filename
        
        try:
            # Decode base64 screenshot data
            if screenshot_data.startswith('data:image'):
                # Remove data URL prefix
                screenshot_data = screenshot_data.split(',')[1]
            
            screenshot_bytes = base64.b64decode(screenshot_data)
            
            # Save screenshot
            async with aiofiles.open(screenshot_path, 'wb') as f:
                await f.write(screenshot_bytes)
            
            # Save metadata
            if metadata:
                metadata_path = guide_screenshot_dir / f"{step_id}_{timestamp}.json"
                async with aiofiles.open(metadata_path, 'w') as f:
                    await f.write(json.dumps(metadata, indent=2))
            
            # Return relative path
            return f"/visual_guides/screenshots/{guide_id}/{filename}"
        
        except Exception as e:
            print(f"Error saving screenshot: {e}")
            raise HTTPException(status_code=500, detail="Failed to save screenshot")

    async def validate_guide_freshness(
        self,
        guide_id: str,
        max_age_days: int = 30
    ) -> Dict[str, Any]:
        """Validate if a guide's screenshots are still fresh"""
        
        guide = await self.get_visual_guide(guide_id)
        if not guide:
            return {"valid": False, "error": "Guide not found"}
        
        issues = []
        confidence = 1.0
        
        # Check guide age
        age_days = (datetime.utcnow() - guide.last_updated).days
        if age_days > max_age_days:
            issues.append(f"Guide is {age_days} days old (max: {max_age_days})")
            confidence *= 0.5
        elif age_days > max_age_days / 2:
            issues.append(f"Guide is getting old ({age_days} days)")
            confidence *= 0.8
        
        # Check screenshot availability
        missing_screenshots = 0
        for step in guide.steps:
            if not step.screenshot:
                missing_screenshots += 1
        
        if missing_screenshots > 0:
            issues.append(f"{missing_screenshots} steps missing screenshots")
            confidence *= (1 - missing_screenshots / len(guide.steps)) * 0.5 + 0.5
        
        return {
            "valid": confidence > 0.7,
            "confidence": confidence,
            "issues": issues,
            "age_days": age_days,
            "missing_screenshots": missing_screenshots
        }

    async def get_guide_recommendations(
        self,
        context: Dict[str, str],
        limit: int = 5,
        db = None
    ) -> List[Dict[str, Any]]:
        """Get guide recommendations based on context"""
        
        route = context.get('route', '')
        page_title = context.get('page_title', '')
        user_role = context.get('user_role', '')
        
        # Get all guides
        all_guides = await self.list_visual_guides(include_outdated=False, limit=100, db=db)
        
        recommendations = []
        
        for guide in all_guides:
            relevance_score = 0.5  # Base score
            
            # Route matching
            route_segment = route.split('/')[1] if '/' in route else route
            if route_segment in guide.tags:
                relevance_score += 0.3
            
            # Page title matching
            if page_title.lower() in guide.title.lower():
                relevance_score += 0.2
            
            # Role-based relevance
            if user_role == 'admin' and guide.difficulty == 'advanced':
                relevance_score += 0.1
            elif user_role == 'user' and guide.difficulty == 'beginner':
                relevance_score += 0.1
            
            # Category relevance
            if route_segment == 'projects' and guide.category == 'feature':
                relevance_score += 0.1
            elif route_segment == 'onboarding' and guide.category == 'onboarding':
                relevance_score += 0.2
            
            recommendations.append({
                "guide": guide,
                "relevance_score": min(relevance_score, 1.0),
                "reason": f"Recommended for {page_title} users"
            })
        
        # Sort by relevance score
        recommendations.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        return recommendations[:limit]

    async def track_guide_completion(
        self,
        guide_id: str,
        user_id: str,
        completed_steps: List[str],
        completion_time: float,
        db = None
    ) -> bool:
        """Track guide completion for analytics"""
        
        try:
            # Update guide completion rate
            guide = await self.get_visual_guide(guide_id, db)
            if guide:
                total_steps = len(guide.steps)
                completed_count = len(completed_steps)
                completion_rate = completed_count / total_steps if total_steps > 0 else 0
                
                # Update guide statistics
                await self.update_visual_guide(
                    guide_id,
                    {
                        "completion_rate": (guide.completion_rate + completion_rate) / 2,
                        "usage_count": guide.usage_count + 1
                    },
                    db
                )
            
            # Store completion record (in a real implementation, this would go to a database)
            completion_record = {
                "guide_id": guide_id,
                "user_id": user_id,
                "completed_steps": completed_steps,
                "completion_time": completion_time,
                "completion_rate": completion_rate,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Save to analytics file
            analytics_file = self.storage_path / "analytics" / f"{guide_id}_completions.jsonl"
            analytics_file.parent.mkdir(exist_ok=True)
            
            async with aiofiles.open(analytics_file, 'a') as f:
                await f.write(json.dumps(completion_record) + '\n')
            
            return True
        
        except Exception as e:
            print(f"Error tracking guide completion: {e}")
            return False

    # Private helper methods
    
    async def _save_guide_to_file(self, guide: VisualGuide):
        """Save guide to JSON file"""
        guide_file = self.guide_path / f"{guide.id}.json"
        guide_dict = self._guide_to_dict(guide)
        
        async with aiofiles.open(guide_file, 'w') as f:
            await f.write(json.dumps(guide_dict, indent=2, default=str))

    async def _save_guide_to_db(self, guide: VisualGuide, db: Session):
        """Save guide metadata to database"""
        try:
            help_content = HelpContent(
                id=guide.id,
                content_type='visual_guide',
                title=guide.title,
                content=guide.description,
                tags=guide.tags,
                language='en',
                version=1,
                is_active=True
            )
            db.add(help_content)
            db.commit()
        except Exception as e:
            print(f"Error saving guide to database: {e}")
            db.rollback()

    async def _update_guide_in_db(self, guide: VisualGuide, db: Session):
        """Update guide metadata in database"""
        try:
            help_content = db.query(HelpContent).filter(HelpContent.id == guide.id).first()
            if help_content:
                help_content.title = guide.title
                help_content.content = guide.description
                help_content.tags = guide.tags
                help_content.updated_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            print(f"Error updating guide in database: {e}")
            db.rollback()

    async def _delete_guide_from_db(self, guide_id: str, db: Session):
        """Delete guide from database"""
        try:
            help_content = db.query(HelpContent).filter(HelpContent.id == guide_id).first()
            if help_content:
                db.delete(help_content)
                db.commit()
        except Exception as e:
            print(f"Error deleting guide from database: {e}")
            db.rollback()

    async def _increment_usage_count(self, guide_id: str, db: Session):
        """Increment guide usage count"""
        # This would typically update a usage counter in the database
        pass

    def _guide_to_dict(self, guide: VisualGuide) -> Dict[str, Any]:
        """Convert VisualGuide to dictionary"""
        guide_dict = asdict(guide)
        
        # Convert datetime to string
        if isinstance(guide_dict['last_updated'], datetime):
            guide_dict['last_updated'] = guide_dict['last_updated'].isoformat()
        
        return guide_dict

    def _dict_to_guide(self, guide_dict: Dict[str, Any]) -> VisualGuide:
        """Convert dictionary to VisualGuide"""
        
        # Convert datetime string back to datetime
        if isinstance(guide_dict['last_updated'], str):
            guide_dict['last_updated'] = datetime.fromisoformat(guide_dict['last_updated'])
        
        # Convert steps
        steps = []
        for step_dict in guide_dict.get('steps', []):
            # Convert annotations
            annotations = []
            for ann_dict in step_dict.get('annotations', []):
                annotation = ScreenshotAnnotation(**ann_dict)
                annotations.append(annotation)
            
            step_dict['annotations'] = annotations
            step = VisualGuideStep(**step_dict)
            steps.append(step)
        
        guide_dict['steps'] = steps
        
        return VisualGuide(**guide_dict)

    def _matches_filters(
        self,
        guide: VisualGuide,
        category: str = None,
        difficulty: str = None,
        tags: List[str] = None,
        search_query: str = None,
        include_outdated: bool = False
    ) -> bool:
        """Check if guide matches the given filters"""
        
        # Category filter
        if category and guide.category != category:
            return False
        
        # Difficulty filter
        if difficulty and guide.difficulty != difficulty:
            return False
        
        # Tags filter
        if tags:
            guide_tags_lower = [tag.lower() for tag in guide.tags]
            if not any(tag.lower() in guide_tags_lower for tag in tags):
                return False
        
        # Search query filter
        if search_query:
            query_lower = search_query.lower()
            if not (
                query_lower in guide.title.lower() or
                query_lower in guide.description.lower() or
                any(query_lower in tag.lower() for tag in guide.tags)
            ):
                return False
        
        # Outdated filter
        if not include_outdated and guide.is_outdated:
            return False
        
        return True


# Singleton instance
visual_guide_service = VisualGuideService()