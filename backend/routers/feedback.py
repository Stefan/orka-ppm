"""
Feedback system endpoints - feature requests, bug reports, notifications
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from uuid import UUID
from typing import Optional, List
from datetime import datetime, timedelta

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from models.feedback import (
    FeatureRequestCreate, FeatureRequestResponse, FeatureVoteCreate, 
    FeatureCommentCreate, FeatureCommentResponse,
    BugReportCreate, BugReportResponse, FeedbackStatsResponse,
    NotificationCreate, NotificationResponse
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/feedback", tags=["feedback"])
notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])

# Feature Management Endpoints
@router.post("/features", response_model=FeatureRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_feature_request(feature: FeatureRequestCreate, current_user = Depends(get_current_user)):
    """Create a new feature request"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        feature_data = feature.dict()
        feature_data['submitted_by'] = current_user.get("user_id")
        feature_data['status'] = 'pending'
        feature_data['votes_count'] = 0
        feature_data['comments_count'] = 0
        
        response = supabase.table("feature_requests").insert(feature_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create feature request")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create feature request error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create feature request: {str(e)}")

@router.get("/features")
async def list_feature_requests(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """Get feature requests with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("feature_requests").select("*")
        
        if status:
            query = query.eq("status", status)
        
        if priority:
            query = query.eq("priority", priority)
        
        if tag:
            query = query.contains("tags", [tag])
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        print(f"List feature requests error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get feature requests: {str(e)}")

@router.get("/features/{feature_id}", response_model=FeatureRequestResponse)
async def get_feature_request(feature_id: UUID, current_user = Depends(get_current_user)):
    """Get a specific feature request"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("feature_requests").select("*").eq("id", str(feature_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Feature request not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get feature request error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get feature request: {str(e)}")

@router.post("/features/{feature_id}/vote")
async def vote_on_feature(
    feature_id: UUID, 
    vote: FeatureVoteCreate, 
    current_user = Depends(get_current_user)
):
    """Vote on a feature request"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id")
        
        # Check if user already voted
        existing_vote = supabase.table("feature_votes").select("*").eq("feature_id", str(feature_id)).eq("user_id", user_id).execute()
        
        if existing_vote.data:
            # Update existing vote
            vote_data = {"vote_type": vote.vote_type}
            supabase.table("feature_votes").update(vote_data).eq("feature_id", str(feature_id)).eq("user_id", user_id).execute()
        else:
            # Create new vote
            vote_data = {
                "feature_id": str(feature_id),
                "user_id": user_id,
                "vote_type": vote.vote_type
            }
            supabase.table("feature_votes").insert(vote_data).execute()
        
        # Update vote count on feature request
        votes_response = supabase.table("feature_votes").select("vote_type").eq("feature_id", str(feature_id)).execute()
        votes = votes_response.data or []
        
        upvotes = len([v for v in votes if v.get("vote_type") == "upvote"])
        downvotes = len([v for v in votes if v.get("vote_type") == "downvote"])
        net_votes = upvotes - downvotes
        
        supabase.table("feature_requests").update({"votes_count": net_votes}).eq("id", str(feature_id)).execute()
        
        return {"message": "Vote recorded successfully", "net_votes": net_votes}
        
    except Exception as e:
        print(f"Vote on feature error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to record vote: {str(e)}")

@router.post("/features/{feature_id}/comments", response_model=FeatureCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_feature_comment(
    feature_id: UUID, 
    comment: FeatureCommentCreate, 
    current_user = Depends(get_current_user)
):
    """Add a comment to a feature request"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        comment_data = comment.dict()
        comment_data['feature_id'] = str(feature_id)
        comment_data['author_id'] = current_user.get("user_id")
        
        response = supabase.table("feature_comments").insert(comment_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to add comment")
        
        # Update comment count
        comments_response = supabase.table("feature_comments").select("id", count="exact").eq("feature_id", str(feature_id)).execute()
        comment_count = comments_response.count or 0
        
        supabase.table("feature_requests").update({"comments_count": comment_count}).eq("id", str(feature_id)).execute()
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Add feature comment error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to add comment: {str(e)}")

@router.get("/features/{feature_id}/comments")
async def get_feature_comments(feature_id: UUID, current_user = Depends(get_current_user)):
    """Get comments for a feature request"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("feature_comments").select("*").eq("feature_id", str(feature_id)).order("created_at", desc=False).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        print(f"Get feature comments error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get comments: {str(e)}")

# Bug Management Endpoints
@router.post("/bugs", response_model=BugReportResponse, status_code=status.HTTP_201_CREATED)
async def create_bug_report(bug: BugReportCreate, current_user = Depends(get_current_user)):
    """Create a new bug report"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        bug_data = bug.dict()
        bug_data['submitted_by'] = current_user.get("user_id")
        bug_data['status'] = 'open'
        bug_data['priority'] = bug_data.get('severity', 'medium')  # Map severity to priority
        
        response = supabase.table("bug_reports").insert(bug_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create bug report")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create bug report error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create bug report: {str(e)}")

@router.get("/bugs")
async def list_bug_reports(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    assigned_to: Optional[UUID] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """Get bug reports with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("bug_reports").select("*")
        
        if status:
            query = query.eq("status", status)
        
        if severity:
            query = query.eq("severity", severity)
        
        if category:
            query = query.eq("category", category)
        
        if assigned_to:
            query = query.eq("assigned_to", str(assigned_to))
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        print(f"List bug reports error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get bug reports: {str(e)}")

@router.get("/bugs/{bug_id}", response_model=BugReportResponse)
async def get_bug_report(bug_id: UUID, current_user = Depends(get_current_user)):
    """Get a specific bug report"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("bug_reports").select("*").eq("id", str(bug_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Bug report not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get bug report error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get bug: {str(e)}")

# Admin Moderation Endpoints
@router.get("/admin/stats", response_model=FeedbackStatsResponse)
async def get_feedback_statistics(
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(require_permission(Permission.system_admin))
):
    """Get feedback system statistics for admins"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get feature request stats
        features_response = supabase.table("feature_requests").select("status").execute()
        features = features_response.data or []
        
        total_features = len(features)
        pending_features = len([f for f in features if f.get("status") == "pending"])
        in_progress_features = len([f for f in features if f.get("status") == "in_progress"])
        completed_features = len([f for f in features if f.get("status") == "completed"])
        
        # Get bug report stats
        bugs_response = supabase.table("bug_reports").select("status, severity, created_at, resolved_at").execute()
        bugs = bugs_response.data or []
        
        total_bugs = len(bugs)
        open_bugs = len([b for b in bugs if b.get("status") in ["open", "in_progress"]])
        resolved_bugs = len([b for b in bugs if b.get("status") in ["resolved", "closed"]])
        critical_bugs = len([b for b in bugs if b.get("severity") == "critical"])
        
        # Calculate average resolution time
        resolved_bugs_with_times = [
            b for b in bugs 
            if b.get("resolved_at") and b.get("created_at")
        ]
        
        avg_resolution_time_days = None
        if resolved_bugs_with_times:
            total_resolution_time = 0
            for bug in resolved_bugs_with_times:
                created = datetime.fromisoformat(bug["created_at"].replace("Z", "+00:00"))
                resolved = datetime.fromisoformat(bug["resolved_at"].replace("Z", "+00:00"))
                resolution_time = (resolved - created).days
                total_resolution_time += resolution_time
            
            avg_resolution_time_days = total_resolution_time / len(resolved_bugs_with_times)
        
        return FeedbackStatsResponse(
            total_features=total_features,
            pending_features=pending_features,
            in_progress_features=in_progress_features,
            completed_features=completed_features,
            total_bugs=total_bugs,
            open_bugs=open_bugs,
            resolved_bugs=resolved_bugs,
            critical_bugs=critical_bugs,
            avg_resolution_time_days=avg_resolution_time_days,
            user_satisfaction_score=None  # Would be calculated from user feedback
        )
        
    except Exception as e:
        print(f"Get feedback statistics error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get feedback statistics: {str(e)}")

@router.put("/admin/features/{feature_id}/assign")
async def assign_feature_request(
    feature_id: UUID,
    assigned_to: UUID,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """Assign a feature request to a team member"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        update_data = {"assigned_to": str(assigned_to)}
        response = supabase.table("feature_requests").update(update_data).eq("id", str(feature_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Feature request not found")
        
        return {"message": "Feature request assigned successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Assign feature request error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to assign feature request: {str(e)}")

@router.put("/admin/bugs/{bug_id}/assign")
async def assign_bug_report(
    bug_id: UUID,
    assigned_to: UUID,
    current_user = Depends(require_permission(Permission.system_admin))
):
    """Assign a bug report to a team member"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        update_data = {"assigned_to": str(assigned_to)}
        response = supabase.table("bug_reports").update(update_data).eq("id", str(bug_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Bug report not found")
        
        return {"message": "Bug report assigned successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Assign bug report error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to assign bug: {str(e)}")

# Notification Endpoints
@notifications_router.get("/")
async def get_user_notifications(
    is_read: Optional[bool] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """Get user notifications"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id")
        query = supabase.table("notifications").select("*").eq("user_id", user_id)
        if is_read is not None:
            query = query.eq("is_read", is_read)
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return convert_uuids(response.data or [])
        
    except Exception as e:
        print(f"Get user notifications error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get notifications: {str(e)}")

@notifications_router.put("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: UUID, 
    current_user = Depends(get_current_user)
):
    """Mark a notification as read"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id")
        update_data = {
            "is_read": True,
            "read_at": datetime.now().isoformat()
        }
        
        response = supabase.table("notifications").update(update_data).eq("id", str(notification_id)).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Mark notification as read error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")

@notifications_router.put("/mark-all-read")
async def mark_all_notifications_as_read(current_user = Depends(get_current_user)):
    """Mark all user notifications as read"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id")
        update_data = {
            "is_read": True,
            "read_at": datetime.now().isoformat()
        }
        
        response = supabase.table("notifications").update(update_data).eq("user_id", user_id).eq("is_read", False).execute()
        
        return {"message": f"Marked {len(response.data or [])} notifications as read"}
        
    except Exception as e:
        print(f"Mark all notifications as read error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark all notifications as read: {str(e)}")

# Include the notifications router
router.include_router(notifications_router)