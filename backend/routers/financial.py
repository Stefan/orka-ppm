"""
Financial tracking and budget management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query, Request
from uuid import UUID
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal
import logging
import json

from auth.rbac import require_permission, Permission
from auth.dependencies import get_current_user
from config.database import supabase
from models.financial import (
    BudgetAlertRuleCreate, BudgetAlertRuleResponse, BudgetAlertResponse,
    FinancialTrackingCreate, FinancialTrackingResponse,
    FinancialSummary, ComprehensiveFinancialReport
)
from utils.converters import convert_uuids
from services.workflow_ppm_integration import WorkflowPPMIntegration
from services.enterprise_audit_service import EnterpriseAuditService

router = APIRouter(prefix="/financial-tracking", tags=["financial"])
budget_alerts_router = APIRouter(prefix="/budget-alerts", tags=["budget-alerts"])
logger = logging.getLogger(__name__)


def _to_float(val: Any) -> float:
    """Coerce None or invalid values to float; DB nulls can make .get return None."""
    if val is None:
        return 0.0
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0

# Initialize PPM integration service lazily
_ppm_integration = None


def get_ppm_integration() -> Optional[WorkflowPPMIntegration]:
    """Get or initialize PPM integration service"""
    global _ppm_integration
    if _ppm_integration is None and supabase:
        try:
            _ppm_integration = WorkflowPPMIntegration(supabase)
        except Exception as e:
            logger.error(f"Failed to initialize PPM integration: {e}")
            return None
    return _ppm_integration

# Financial Tracking Endpoints
@router.post("/", response_model=FinancialTrackingResponse, status_code=status.HTTP_201_CREATED)
async def create_financial_entry(
    entry: FinancialTrackingCreate,
    request: Request,
    current_user=Depends(get_current_user),
):
    """
    Create a new financial tracking entry.
    
    Automatically triggers budget approval workflow if variance exceeds threshold.
    
    Requirements: 7.1, 7.4
    """
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get user ID
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")
        
        # Verify project exists and get budget info
        project_response = supabase.table("projects").select(
            "id, budget, actual_cost"
        ).eq("id", str(entry.project_id)).execute()
        
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = project_response.data[0]
        budget = Decimal(str(project.get("budget", 0)))
        
        entry_data = entry.dict()
        entry_data['project_id'] = str(entry_data['project_id'])
        
        response = supabase.table("financial_tracking").insert(entry_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create financial entry")
        
        created_entry = response.data[0]
        financial_record_id = UUID(created_entry["id"])
        
        # Calculate updated actual cost
        expenses_response = supabase.table("financial_tracking").select(
            "amount"
        ).eq("project_id", str(entry.project_id)).eq(
            "transaction_type", "expense"
        ).execute()
        
        total_spent = sum(
            Decimal(str(expense.get('amount', 0))) 
            for expense in expenses_response.data or []
        )
        
        # Update project actual cost
        supabase.table("projects").update({
            "actual_cost": str(total_spent)
        }).eq("id", str(entry.project_id)).execute()
        
        # Check for budget variance and trigger workflow if needed
        if budget > 0:
            variance_amount = total_spent - budget
            variance_percentage = float((variance_amount / budget) * 100)
            
            # Trigger workflow if variance exceeds threshold
            ppm_integration = get_ppm_integration()
            if ppm_integration:
                try:
                    workflow_instance_id = await ppm_integration.check_budget_variance_trigger(
                        project_id=entry.project_id,
                        financial_record_id=financial_record_id,
                        variance_amount=variance_amount,
                        variance_percentage=variance_percentage,
                        budget_amount=budget,
                        actual_amount=total_spent,
                        user_id=UUID(user_id)
                    )
                    
                    if workflow_instance_id:
                        logger.info(
                            f"Triggered budget approval workflow {workflow_instance_id} "
                            f"for financial entry {financial_record_id}"
                        )
                except Exception as e:
                    logger.error(f"Error triggering budget workflow: {e}")
                    # Don't fail the financial entry creation if workflow fails

        # Phase 1: SOX audit log
        try:
            ip = request.client.host if request.client else None
            EnterpriseAuditService().log(
                user_id=str(user_id),
                action="CREATE",
                entity="financial_tracking",
                entity_id=str(created_entry.get("id")),
                new_value=json.dumps({"project_id": str(entry.project_id), "amount": getattr(entry, "amount", None)}, default=str),
                ip=ip,
            )
        except Exception as e:
            logger.warning("Enterprise audit log failed: %s", e)

        return convert_uuids(created_entry)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create financial entry error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create financial entry: {str(e)}")

@router.get("/")
async def list_financial_entries(
    project_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get financial tracking entries with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("financial_tracking").select("*")
        
        if project_id:
            query = query.eq("project_id", str(project_id))
        
        if category:
            query = query.eq("category", category)
        
        if transaction_type:
            query = query.eq("transaction_type", transaction_type)
        
        if start_date:
            query = query.gte("date_incurred", start_date.isoformat())
        
        if end_date:
            query = query.lte("date_incurred", end_date.isoformat())
        
        response = query.order("date_incurred", desc=True).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        logger.exception("List financial entries error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get financial entries: {str(e)}")

@router.get("/budget-alerts")
async def get_financial_tracking_budget_alerts(
    threshold_percentage: float = Query(80.0, description="Minimum threshold percentage for alerts"),
    current_user = Depends(get_current_user)
):
    """Get budget alerts for projects exceeding specified threshold"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get all projects with budget information
        projects_response = supabase.table("projects").select("id, name, budget").execute()
        projects = projects_response.data or []
        if not projects:
            return {
                "threshold_percentage": threshold_percentage,
                "total_alerts": 0,
                "alerts": [],
                "generated_at": datetime.now().isoformat()
            }

        project_ids = [p["id"] for p in projects]
        # Single query for all spending (avoids N+1)
        expenses_response = supabase.table("financial_tracking").select("project_id, actual_amount").in_("project_id", project_ids).execute()
        expenses = expenses_response.data or []
        spent_by_project: dict = {}
        for e in expenses:
            pid = e.get("project_id")
            if pid is None:
                continue
            amt = _to_float(e.get("actual_amount"))
            if amt <= 0:
                continue
            spent_by_project[pid] = spent_by_project.get(pid, 0.0) + amt

        alerts = []
        for project in projects:
            project_id = project["id"]
            budget = _to_float(project.get("budget"))
            if budget <= 0:
                continue
            total_spent = spent_by_project.get(project_id, 0.0)
            current_percentage = (total_spent / budget * 100) if budget > 0 else 0
            if current_percentage >= threshold_percentage:
                alerts.append({
                    "project_id": project_id,
                    "project_name": project["name"],
                    "budget_amount": budget,
                    "spent_amount": total_spent,
                    "current_percentage": round(current_percentage, 2),
                    "threshold_percentage": threshold_percentage,
                    "variance": total_spent - budget,
                    "alert_level": "critical" if current_percentage >= 100 else "warning"
                })

        return {
            "threshold_percentage": threshold_percentage,
            "total_alerts": len(alerts),
            "alerts": alerts,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.exception("Get budget alerts error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get budget alerts: {str(e)}")

@router.get("/comprehensive-report")
async def get_comprehensive_financial_report(
    currency: str = Query("USD", description="Currency code for the report"),
    include_trends: bool = Query(True, description="Include trend analysis"),
    project_id: Optional[UUID] = Query(None, description="Filter by specific project"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user = Depends(get_current_user)
):
    """Generate comprehensive financial report"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Build base query
        projects_query = supabase.table("projects").select("id, name, budget, actual_cost")
        if project_id:
            projects_query = projects_query.eq("id", str(project_id))
        
        projects_response = projects_query.execute()
        projects = projects_response.data or []
        
        # Build financial entries query (limit when no project filter to avoid huge pull)
        financial_query = supabase.table("financial_tracking").select("id, project_id, amount, transaction_type, date_incurred")
        if project_id:
            financial_query = financial_query.eq("project_id", str(project_id))
        if start_date:
            financial_query = financial_query.gte("date_incurred", start_date.isoformat())
        if end_date:
            financial_query = financial_query.lte("date_incurred", end_date.isoformat())
        if not project_id:
            financial_query = financial_query.limit(50000)
        financial_response = financial_query.execute()
        financial_entries = financial_response.data or []

        # Calculate summary metrics (budget/amount may be None from DB)
        total_budget = sum(_to_float(p.get('budget')) for p in projects)
        total_spent = sum(_to_float(f.get('amount')) for f in financial_entries if f.get('transaction_type') == 'expense')
        total_income = sum(_to_float(f.get('amount')) for f in financial_entries if f.get('transaction_type') == 'income')

        # Project-level analysis
        project_summaries = []
        for project in projects:
            project_id_str = project['id']
            project_budget = _to_float(project.get('budget'))

            # Get project-specific financial entries
            project_entries = [f for f in financial_entries if f.get('project_id') == project_id_str]
            project_spent = sum(_to_float(f.get('amount')) for f in project_entries if f.get('transaction_type') == 'expense')
            project_income = sum(_to_float(f.get('amount')) for f in project_entries if f.get('transaction_type') == 'income')
            
            utilization = (project_spent / project_budget * 100) if project_budget > 0 else 0
            variance = project_spent - project_budget
            
            project_summaries.append({
                "project_id": project_id_str,
                "project_name": project['name'],
                "budget": project_budget,
                "spent": project_spent,
                "income": project_income,
                "remaining": project_budget - project_spent,
                "utilization_percentage": round(utilization, 2),
                "variance": variance,
                "status": "over_budget" if variance > 0 else "under_budget" if variance < -project_budget * 0.1 else "on_track"
            })
        
        # Generate trends (simplified) - only if requested
        trends = None
        if include_trends:
            trends = {
                "monthly_spending": {},  # Would calculate monthly aggregates
                "category_breakdown": {},  # Would group by category
                "variance_trend": "stable"  # Would analyze variance over time
            }
        
        # Get active alerts (optional table; do not fail report on missing table)
        active_alerts = []
        try:
            alerts_response = supabase.table("budget_alerts").select("*").eq("is_resolved", False).execute()
            active_alerts = alerts_response.data or []
        except Exception as alert_err:
            logger.debug("Budget alerts table unavailable or error: %s", alert_err)
        try:
            alerts_out = convert_uuids(active_alerts) if active_alerts else []
        except Exception:
            alerts_out = active_alerts

        response_data = {
            "summary": {
                "total_budget": total_budget,
                "total_spent": total_spent,
                "total_income": total_income,
                "overall_utilization": (total_spent / total_budget * 100) if total_budget > 0 else 0,
                "projects_count": len(projects),
                "over_budget_projects": len([p for p in project_summaries if p["variance"] > 0]),
                "active_alerts": len(active_alerts),
                "currency": currency
            },
            "projects": project_summaries,
            "alerts": alerts_out,
            "generated_at": datetime.now().isoformat(),
            "filters": {
                "project_id": str(project_id) if project_id else None,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "currency": currency
            }
        }
        
        # Only include trends if requested
        if include_trends and trends:
            response_data["trends"] = trends
        
        return response_data
        
    except Exception as e:
        logger.exception("Generate financial report error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to generate financial report: {str(e)}")

# Budget Alert Endpoints
@budget_alerts_router.post("/rules/", response_model=BudgetAlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_budget_alert_rule(
    rule: BudgetAlertRuleCreate, 
    current_user = Depends(require_permission(Permission.budget_alert_manage))
):
    """Create a new budget alert rule"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate threshold percentage
        if not (0 < rule.threshold_percentage <= 100):
            raise HTTPException(status_code=400, detail="Threshold percentage must be between 0 and 100")
        
        # Verify project exists if project_id is provided
        if rule.project_id:
            project_response = supabase.table("projects").select("id").eq("id", str(rule.project_id)).execute()
            if not project_response.data:
                raise HTTPException(status_code=404, detail="Project not found")
        
        rule_data = rule.dict()
        if rule_data.get('project_id'):
            rule_data['project_id'] = str(rule_data['project_id'])
        
        response = supabase.table("budget_alert_rules").insert(rule_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create budget alert rule")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create budget alert rule error: %s", e)
        raise HTTPException(status_code=400, detail=f"Failed to create budget alert rule: {str(e)}")

@budget_alerts_router.get("/rules/")
async def list_budget_alert_rules(
    project_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get all budget alert rules with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("budget_alert_rules").select("*")
        
        if project_id:
            query = query.eq("project_id", str(project_id))
        
        if is_active is not None:
            query = query.eq("is_active", is_active)
        
        response = query.order("created_at", desc=True).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        logger.exception("List budget alert rules error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get budget alert rules: {str(e)}")

@budget_alerts_router.get("/rules/{rule_id}", response_model=BudgetAlertRuleResponse)
async def get_budget_alert_rule(rule_id: UUID, current_user = Depends(get_current_user)):
    """Get a specific budget alert rule"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("budget_alert_rules").select("*").eq("id", str(rule_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Budget alert rule not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get budget alert rule error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get budget alert rule: {str(e)}")

@budget_alerts_router.put("/rules/{rule_id}", response_model=BudgetAlertRuleResponse)
async def update_budget_alert_rule(
    rule_id: UUID, 
    rule_update: BudgetAlertRuleCreate, 
    current_user = Depends(get_current_user)
):
    """Update a budget alert rule"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Validate threshold percentage
        if not (0 < rule_update.threshold_percentage <= 100):
            raise HTTPException(status_code=400, detail="Threshold percentage must be between 0 and 100")
        
        update_data = rule_update.dict()
        if update_data.get('project_id'):
            update_data['project_id'] = str(update_data['project_id'])
        
        response = supabase.table("budget_alert_rules").update(update_data).eq("id", str(rule_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Budget alert rule not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Update budget alert rule error: %s", e)
        raise HTTPException(status_code=400, detail=f"Failed to update budget alert rule: {str(e)}")

@budget_alerts_router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget_alert_rule(rule_id: UUID, current_user = Depends(get_current_user)):
    """Delete a budget alert rule"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        response = supabase.table("budget_alert_rules").delete().eq("id", str(rule_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Budget alert rule not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Delete budget alert rule error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to delete budget alert rule: {str(e)}")

@budget_alerts_router.get("/")
async def list_budget_alerts(
    project_id: Optional[UUID] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    current_user = Depends(get_current_user)
):
    """Get all budget alerts with optional filtering"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        query = supabase.table("budget_alerts").select("*")
        
        if project_id:
            query = query.eq("project_id", str(project_id))
        
        if is_resolved is not None:
            query = query.eq("is_resolved", is_resolved)
        
        response = query.order("created_at", desc=True).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        logger.exception("List budget alerts error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get budget alerts: {str(e)}")

@budget_alerts_router.post("/monitor")
async def monitor_project_budgets(current_user = Depends(get_current_user)):
    """Manually trigger budget monitoring for all projects"""
    try:
        # This would implement the budget monitoring logic
        # For now, return a success message
        return {"message": "Budget monitoring triggered successfully", "timestamp": datetime.now().isoformat()}
        
    except Exception as e:
        logger.exception("Budget monitoring error: %s", e)
        raise HTTPException(status_code=500, detail=f"Budget monitoring failed: {str(e)}")

@budget_alerts_router.post("/{alert_id}/resolve")
async def resolve_budget_alert(alert_id: UUID, current_user = Depends(get_current_user)):
    """Mark a budget alert as resolved"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        update_data = {
            "is_resolved": True,
            "resolved_by": current_user.get("user_id"),
            "resolved_at": datetime.now().isoformat()
        }
        
        response = supabase.table("budget_alerts").update(update_data).eq("id", str(alert_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Budget alert not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Resolve budget alert error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to resolve budget alert: {str(e)}")

@budget_alerts_router.get("/summary")
async def get_budget_alerts_summary(current_user = Depends(get_current_user)):
    """Get summary of budget alerts"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get all alerts
        alerts_response = supabase.table("budget_alerts").select("*").execute()
        alerts = alerts_response.data or []
        
        # Calculate summary metrics
        total_alerts = len(alerts)
        active_alerts = len([a for a in alerts if not a.get('is_resolved', False)])
        resolved_alerts = total_alerts - active_alerts
        
        # Group by alert type
        alert_types = {}
        for alert in alerts:
            alert_type = alert.get('alert_type', 'unknown')
            if alert_type not in alert_types:
                alert_types[alert_type] = 0
            alert_types[alert_type] += 1
        
        return {
            "total_alerts": total_alerts,
            "active_alerts": active_alerts,
            "resolved_alerts": resolved_alerts,
            "alert_types": alert_types,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.exception("Get budget alerts summary error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get budget alerts summary: {str(e)}")

# Include the budget alerts router in the main router
router.include_router(budget_alerts_router)