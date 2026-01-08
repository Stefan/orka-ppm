"""
Risk and Issue management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from uuid import UUID
from typing import Optional

from auth.dependencies import get_current_user
from config.database import supabase
from models.risks import (
    RiskCreate, RiskResponse, RiskUpdate, RiskCategory, RiskStatus,
    IssueCreate, IssueResponse, IssueUpdate, IssueSeverity, IssueStatus,
    RiskForecastRequest
)
from utils.converters import convert_uuids

router = APIRouter(prefix="/risks", tags=["risks"])
issues_router = APIRouter(prefix="/issues", tags=["issues"])

# Risk Management Endpoints
@router.post("/", response_model=RiskResponse, status_code=status.HTTP_201_CREATED)
async def create_risk(risk: RiskCreate, current_user = Depends(get_current_user)):
    """Create a new risk entry in the risk register"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Verify project exists
        project_response = supabase.table("projects").select("id").eq("id", str(risk.project_id)).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate probability and impact ranges
        if not (0.0 <= risk.probability <= 1.0):
            raise HTTPException(status_code=400, detail="Probability must be between 0.0 and 1.0")
        
        if not (0.0 <= risk.impact <= 1.0):
            raise HTTPException(status_code=400, detail="Impact must be between 0.0 and 1.0")
        
        risk_data = risk.dict()
        risk_data['project_id'] = str(risk_data['project_id'])
        if risk_data.get('owner_id'):
            risk_data['owner_id'] = str(risk_data['owner_id'])
        
        response = supabase.table("risks").insert(risk_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create risk")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create risk error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create risk: {str(e)}")

@router.get("/")
async def list_risks(
    project_id: Optional[UUID] = Query(None),
    category: Optional[RiskCategory] = Query(None),
    status: Optional[RiskStatus] = Query(None),
    owner_id: Optional[UUID] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get all risks with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("risks").select("*")
        
        if project_id:
            query = query.eq("project_id", str(project_id))
        
        if category:
            query = query.eq("category", category.value)
        
        if status:
            query = query.eq("status", status.value)
        
        if owner_id:
            query = query.eq("owner_id", str(owner_id))
        
        response = query.order("created_at", desc=True).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        print(f"List risks error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get risks: {str(e)}")

@router.get("/{risk_id}", response_model=RiskResponse)
async def get_risk(risk_id: UUID, current_user = Depends(get_current_user)):
    """Get a specific risk by ID"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("risks").select("*").eq("id", str(risk_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Risk not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get risk error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get risk: {str(e)}")

@router.put("/{risk_id}", response_model=RiskResponse)
async def update_risk(risk_id: UUID, risk_update: RiskUpdate, current_user = Depends(get_current_user)):
    """Update a risk entry with audit trail maintenance"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Only include non-None fields in the update
        update_data = {k: v for k, v in risk_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Validate probability and impact if provided
        if 'probability' in update_data and not (0.0 <= update_data['probability'] <= 1.0):
            raise HTTPException(status_code=400, detail="Probability must be between 0.0 and 1.0")
        
        if 'impact' in update_data and not (0.0 <= update_data['impact'] <= 1.0):
            raise HTTPException(status_code=400, detail="Impact must be between 0.0 and 1.0")
        
        # Convert UUIDs to strings
        if 'owner_id' in update_data and update_data['owner_id']:
            update_data['owner_id'] = str(update_data['owner_id'])
        
        response = supabase.table("risks").update(update_data).eq("id", str(risk_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Risk not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update risk error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to update risk: {str(e)}")

@router.delete("/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_risk(risk_id: UUID, current_user = Depends(get_current_user)):
    """Delete a risk entry"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("risks").delete().eq("id", str(risk_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Risk not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete risk error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete risk: {str(e)}")

# Issue Management Endpoints
@issues_router.post("/", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(issue: IssueCreate, current_user = Depends(get_current_user)):
    """Create a new issue entry in the issue register"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Verify project exists
        project_response = supabase.table("projects").select("id").eq("id", str(issue.project_id)).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Verify risk exists if risk_id is provided
        if issue.risk_id:
            risk_response = supabase.table("risks").select("id").eq("id", str(issue.risk_id)).execute()
            if not risk_response.data:
                raise HTTPException(status_code=404, detail="Risk not found")
        
        issue_data = issue.dict()
        issue_data['project_id'] = str(issue_data['project_id'])
        if issue_data.get('risk_id'):
            issue_data['risk_id'] = str(issue_data['risk_id'])
        if issue_data.get('assigned_to'):
            issue_data['assigned_to'] = str(issue_data['assigned_to'])
        
        response = supabase.table("issues").insert(issue_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create issue")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create issue error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create issue: {str(e)}")

@issues_router.get("/")
async def list_issues(
    project_id: Optional[UUID] = Query(None),
    risk_id: Optional[UUID] = Query(None),
    severity: Optional[IssueSeverity] = Query(None),
    status: Optional[IssueStatus] = Query(None),
    assigned_to: Optional[UUID] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get all issues with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("issues").select("*")
        
        if project_id:
            query = query.eq("project_id", str(project_id))
        
        if risk_id:
            query = query.eq("risk_id", str(risk_id))
        
        if severity:
            query = query.eq("severity", severity.value)
        
        if status:
            query = query.eq("status", status.value)
        
        if assigned_to:
            query = query.eq("assigned_to", str(assigned_to))
        
        response = query.order("created_at", desc=True).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        print(f"List issues error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get issues: {str(e)}")

@issues_router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: UUID, current_user = Depends(get_current_user)):
    """Get a specific issue by ID"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("issues").select("*").eq("id", str(issue_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get issue error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get issue: {str(e)}")

@issues_router.put("/{issue_id}", response_model=IssueResponse)
async def update_issue(issue_id: UUID, issue_update: IssueUpdate, current_user = Depends(get_current_user)):
    """Update an issue entry"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Only include non-None fields in the update
        update_data = {k: v for k, v in issue_update.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Convert UUIDs to strings
        if 'assigned_to' in update_data and update_data['assigned_to']:
            update_data['assigned_to'] = str(update_data['assigned_to'])
        
        response = supabase.table("issues").update(update_data).eq("id", str(issue_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update issue error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to update issue: {str(e)}")

@issues_router.delete("/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_issue(issue_id: UUID, current_user = Depends(get_current_user)):
    """Delete an issue entry"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("issues").delete().eq("id", str(issue_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete issue error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete issue: {str(e)}")

@issues_router.post("/{issue_id}/resolve", response_model=IssueResponse)
async def resolve_issue(
    issue_id: UUID, 
    resolution: str,
    close_related_risk: bool = False,
    current_user = Depends(get_current_user)
):
    """Resolve an issue and optionally close related risk"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get the issue first
        issue_response = supabase.table("issues").select("*").eq("id", str(issue_id)).execute()
        if not issue_response.data:
            raise HTTPException(status_code=404, detail="Issue not found")
        
        issue = issue_response.data[0]
        
        # Update issue status and resolution
        update_data = {
            "status": IssueStatus.resolved.value,
            "resolution": resolution
        }
        
        response = supabase.table("issues").update(update_data).eq("id", str(issue_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to resolve issue")
        
        # Close related risk if requested and risk exists
        if close_related_risk and issue.get('risk_id'):
            risk_id = issue['risk_id']
            risk_update_data = {"status": RiskStatus.closed.value}
            supabase.table("risks").update(risk_update_data).eq("id", risk_id).execute()
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Resolve issue error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resolve issue: {str(e)}")

@router.get("/projects/{project_id}/summary")
async def get_project_risks_issues_summary(
    project_id: UUID, 
    current_user = Depends(get_current_user)
):
    """Get risks and issues summary for a project"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get risks summary
        risks_response = supabase.table("risks").select("*").eq("project_id", str(project_id)).execute()
        risks = risks_response.data or []
        
        # Get issues summary
        issues_response = supabase.table("issues").select("*").eq("project_id", str(project_id)).execute()
        issues = issues_response.data or []
        
        # Calculate risk metrics
        risk_counts = {}
        for status in RiskStatus:
            risk_counts[status.value] = len([r for r in risks if r.get('status') == status.value])
        
        # Calculate issue metrics
        issue_counts = {}
        for status in IssueStatus:
            issue_counts[status.value] = len([i for i in issues if i.get('status') == status.value])
        
        severity_counts = {}
        for severity in IssueSeverity:
            severity_counts[severity.value] = len([i for i in issues if i.get('severity') == severity.value])
        
        return {
            "project_id": str(project_id),
            "risks": {
                "total": len(risks),
                "by_status": risk_counts,
                "high_impact": len([r for r in risks if r.get('impact', 0) > 0.7]),
                "high_probability": len([r for r in risks if r.get('probability', 0) > 0.7])
            },
            "issues": {
                "total": len(issues),
                "by_status": issue_counts,
                "by_severity": severity_counts,
                "overdue": 0  # Would need to calculate based on due_date
            }
        }
        
    except Exception as e:
        print(f"Get project risks/issues summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project risks/issues summary: {str(e)}")

# Include the issues router in the main router
router.include_router(issues_router)