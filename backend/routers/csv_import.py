"""
CSV import functionality endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query
from uuid import UUID
from typing import Optional, Dict, Any, List
import csv
import io
from datetime import datetime

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from config.database import supabase
from utils.converters import convert_uuids

router = APIRouter(prefix="/csv-import", tags=["csv-import"])

@router.post("/upload")
async def upload_csv_file(
    file: UploadFile = File(...),
    entity_type: str = Form(...),  # "projects", "resources", "risks", "financial_tracking"
    project_id: Optional[UUID] = Form(None),
    current_user = Depends(require_permission(Permission.data_import))
):
    """Upload and process CSV file for data import"""
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV file")
        
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        rows = list(csv_reader)
        
        if not rows:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        # Validate entity type
        valid_entity_types = ["projects", "resources", "risks", "financial_tracking", "issues"]
        if entity_type not in valid_entity_types:
            raise HTTPException(status_code=400, detail=f"Invalid entity type. Must be one of: {valid_entity_types}")
        
        # Process based on entity type
        import_result = await process_csv_import(entity_type, rows, project_id, current_user)
        
        return {
            "message": "CSV import completed",
            "entity_type": entity_type,
            "total_rows": len(rows),
            "successful_imports": import_result["successful"],
            "failed_imports": import_result["failed"],
            "errors": import_result["errors"],
            "import_id": import_result["import_id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"CSV upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV upload: {str(e)}")

async def process_csv_import(entity_type: str, rows: List[Dict], project_id: Optional[UUID], current_user: Dict) -> Dict[str, Any]:
    """Process CSV import based on entity type"""
    successful = 0
    failed = 0
    errors = []
    import_id = f"import-{entity_type}-{int(datetime.now().timestamp())}"
    
    if supabase is None:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    for i, row in enumerate(rows):
        try:
            if entity_type == "projects":
                await import_project_row(row, current_user)
            elif entity_type == "resources":
                await import_resource_row(row, current_user)
            elif entity_type == "risks":
                await import_risk_row(row, project_id, current_user)
            elif entity_type == "financial_tracking":
                await import_financial_row(row, project_id, current_user)
            elif entity_type == "issues":
                await import_issue_row(row, project_id, current_user)
            
            successful += 1
            
        except Exception as e:
            failed += 1
            errors.append({
                "row": i + 1,
                "error": str(e),
                "data": row
            })
    
    # Log import activity
    try:
        import_log = {
            "import_id": import_id,
            "entity_type": entity_type,
            "user_id": current_user.get("user_id"),
            "total_rows": len(rows),
            "successful_imports": successful,
            "failed_imports": failed,
            "errors": errors
        }
        supabase.table("import_logs").insert(import_log).execute()
    except Exception as e:
        print(f"Failed to log import activity: {e}")
    
    return {
        "successful": successful,
        "failed": failed,
        "errors": errors,
        "import_id": import_id
    }

async def import_project_row(row: Dict, current_user: Dict):
    """Import a single project row"""
    required_fields = ["name", "portfolio_id"]
    for field in required_fields:
        if not row.get(field):
            raise ValueError(f"Missing required field: {field}")
    
    project_data = {
        "name": row["name"],
        "portfolio_id": row["portfolio_id"],
        "description": row.get("description"),
        "status": row.get("status", "planning"),
        "priority": row.get("priority"),
        "budget": float(row["budget"]) if row.get("budget") else None,
        "start_date": row.get("start_date"),
        "end_date": row.get("end_date")
    }
    
    response = supabase.table("projects").insert(project_data).execute()
    if not response.data:
        raise ValueError("Failed to insert project")

async def import_resource_row(row: Dict, current_user: Dict):
    """Import a single resource row"""
    required_fields = ["name", "email", "role"]
    for field in required_fields:
        if not row.get(field):
            raise ValueError(f"Missing required field: {field}")
    
    resource_data = {
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "capacity": int(row.get("capacity", 40)),
        "availability": int(row.get("availability", 100)),
        "hourly_rate": float(row["hourly_rate"]) if row.get("hourly_rate") else None,
        "skills": row.get("skills", "").split(",") if row.get("skills") else [],
        "location": row.get("location")
    }
    
    response = supabase.table("resources").insert(resource_data).execute()
    if not response.data:
        raise ValueError("Failed to insert resource")

async def import_risk_row(row: Dict, project_id: Optional[UUID], current_user: Dict):
    """Import a single risk row"""
    required_fields = ["title", "category", "probability", "impact"]
    for field in required_fields:
        if not row.get(field):
            raise ValueError(f"Missing required field: {field}")
    
    # Use provided project_id or get from row
    risk_project_id = str(project_id) if project_id else row.get("project_id")
    if not risk_project_id:
        raise ValueError("Project ID is required for risk import")
    
    risk_data = {
        "project_id": risk_project_id,
        "title": row["title"],
        "description": row.get("description"),
        "category": row["category"],
        "probability": float(row["probability"]),
        "impact": float(row["impact"]),
        "status": row.get("status", "identified"),
        "mitigation": row.get("mitigation"),
        "due_date": row.get("due_date")
    }
    
    response = supabase.table("risks").insert(risk_data).execute()
    if not response.data:
        raise ValueError("Failed to insert risk")

async def import_financial_row(row: Dict, project_id: Optional[UUID], current_user: Dict):
    """Import a single financial tracking row"""
    required_fields = ["category", "amount", "transaction_type", "date_incurred"]
    for field in required_fields:
        if not row.get(field):
            raise ValueError(f"Missing required field: {field}")
    
    # Use provided project_id or get from row
    financial_project_id = str(project_id) if project_id else row.get("project_id")
    if not financial_project_id:
        raise ValueError("Project ID is required for financial tracking import")
    
    financial_data = {
        "project_id": financial_project_id,
        "category": row["category"],
        "description": row.get("description"),
        "amount": float(row["amount"]),
        "currency": row.get("currency", "USD"),
        "transaction_type": row["transaction_type"],
        "date_incurred": row["date_incurred"]
    }
    
    response = supabase.table("financial_tracking").insert(financial_data).execute()
    if not response.data:
        raise ValueError("Failed to insert financial entry")

async def import_issue_row(row: Dict, project_id: Optional[UUID], current_user: Dict):
    """Import a single issue row"""
    required_fields = ["title", "severity"]
    for field in required_fields:
        if not row.get(field):
            raise ValueError(f"Missing required field: {field}")
    
    # Use provided project_id or get from row
    issue_project_id = str(project_id) if project_id else row.get("project_id")
    if not issue_project_id:
        raise ValueError("Project ID is required for issue import")
    
    issue_data = {
        "project_id": issue_project_id,
        "title": row["title"],
        "description": row.get("description"),
        "severity": row["severity"],
        "status": row.get("status", "open"),
        "due_date": row.get("due_date")
    }
    
    response = supabase.table("issues").insert(issue_data).execute()
    if not response.data:
        raise ValueError("Failed to insert issue")

@router.get("/templates/{entity_type}")
async def get_csv_template(
    entity_type: str,
    current_user = Depends(get_current_user)
):
    """Get CSV template for specific entity type"""
    try:
        templates = {
            "projects": {
                "headers": ["name", "portfolio_id", "description", "status", "priority", "budget", "start_date", "end_date"],
                "example": {
                    "name": "New Website Project",
                    "portfolio_id": "uuid-here",
                    "description": "Redesign company website",
                    "status": "planning",
                    "priority": "high",
                    "budget": "50000",
                    "start_date": "2024-02-01",
                    "end_date": "2024-06-30"
                }
            },
            "resources": {
                "headers": ["name", "email", "role", "capacity", "availability", "hourly_rate", "skills", "location"],
                "example": {
                    "name": "John Doe",
                    "email": "john.doe@company.com",
                    "role": "Senior Developer",
                    "capacity": "40",
                    "availability": "100",
                    "hourly_rate": "85",
                    "skills": "React,TypeScript,Node.js",
                    "location": "New York"
                }
            },
            "risks": {
                "headers": ["project_id", "title", "description", "category", "probability", "impact", "status", "mitigation", "due_date"],
                "example": {
                    "project_id": "uuid-here",
                    "title": "Technical Debt Risk",
                    "description": "Accumulated technical debt may slow development",
                    "category": "technical",
                    "probability": "0.7",
                    "impact": "0.6",
                    "status": "identified",
                    "mitigation": "Schedule refactoring sprints",
                    "due_date": "2024-03-15"
                }
            },
            "financial_tracking": {
                "headers": ["project_id", "category", "description", "amount", "currency", "transaction_type", "date_incurred"],
                "example": {
                    "project_id": "uuid-here",
                    "category": "Development",
                    "description": "Developer salaries for January",
                    "amount": "15000",
                    "currency": "USD",
                    "transaction_type": "expense",
                    "date_incurred": "2024-01-31"
                }
            },
            "issues": {
                "headers": ["project_id", "title", "description", "severity", "status", "due_date"],
                "example": {
                    "project_id": "uuid-here",
                    "title": "Login Bug",
                    "description": "Users cannot log in with special characters in password",
                    "severity": "high",
                    "status": "open",
                    "due_date": "2024-01-15"
                }
            }
        }
        
        if entity_type not in templates:
            raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")
        
        return templates[entity_type]
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get CSV template error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get CSV template: {str(e)}")

@router.get("/history")
async def get_import_history(
    entity_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user = Depends(get_current_user)
):
    """Get import history for the current user"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id")
        query = supabase.table("import_logs").select("*").eq("user_id", user_id)
        
        if entity_type:
            query = query.eq("entity_type", entity_type)
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return convert_uuids(response.data)
        
    except Exception as e:
        print(f"Get import history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get import history: {str(e)}")

@router.get("/status/{import_id}")
async def get_import_status(
    import_id: str,
    current_user = Depends(get_current_user)
):
    """Get status of a specific import"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        user_id = current_user.get("user_id")
        response = supabase.table("import_logs").select("*").eq("import_id", import_id).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Import not found")
        
        return convert_uuids(response.data[0])
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get import status error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get import status: {str(e)}")

@router.get("/supported-entities")
async def get_supported_entities(current_user = Depends(get_current_user)):
    """Get list of supported entity types for CSV import"""
    try:
        return {
            "supported_entities": [
                {
                    "type": "projects",
                    "name": "Projects",
                    "description": "Import project data including name, budget, timeline"
                },
                {
                    "type": "resources",
                    "name": "Resources",
                    "description": "Import team members and their skills, capacity, rates"
                },
                {
                    "type": "risks",
                    "name": "Risks",
                    "description": "Import project risks with probability and impact assessments"
                },
                {
                    "type": "financial_tracking",
                    "name": "Financial Tracking",
                    "description": "Import financial transactions and budget tracking data"
                },
                {
                    "type": "issues",
                    "name": "Issues",
                    "description": "Import project issues and bugs with severity levels"
                }
            ]
        }
        
    except Exception as e:
        print(f"Get supported entities error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get supported entities: {str(e)}")

@router.get("/variances")
async def get_financial_variances(
    organization_id: str = "DEFAULT",
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """Get financial variances calculated from project budgets vs actual costs"""
    try:
        if supabase is None:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        
        # Get all projects with budget information
        try:
            projects_response = supabase.table("projects").select("id, name, budget, actual_cost").execute()
            projects = projects_response.data or []
        except Exception as db_error:
            print(f"Database query error: {db_error}")
            # Return empty result instead of failing
            return {
                "variances": [],
                "summary": {
                    "total_variances": 0,
                    "over_budget": 0,
                    "under_budget": 0,
                    "on_budget": 0
                },
                "filters": {
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "status": status,
                    "limit": limit
                }
            }
        
        variances = []
        
        for project in projects:
            try:
                # Skip projects without budget
                if not project.get('budget'):
                    continue
                
                # Safely extract project data with null checks
                project_id_str = str(project.get('id', ''))
                project_name = str(project.get('name', 'Unknown Project'))
                
                # Safely convert to float with fallback
                try:
                    budget = float(project.get('budget', 0))
                except (ValueError, TypeError):
                    budget = 0.0
                
                try:
                    actual_cost = float(project.get('actual_cost', 0))
                except (ValueError, TypeError):
                    actual_cost = 0.0
                
                # Skip if budget is 0 or negative
                if budget <= 0:
                    continue
                
                # Calculate variance
                variance = actual_cost - budget
                variance_percentage = (variance / budget * 100) if budget > 0 else 0
                
                # Determine status based on variance
                if actual_cost < budget * 0.95:
                    status_val = 'under'
                elif actual_cost <= budget * 1.05:
                    status_val = 'on'
                else:
                    status_val = 'over'
                
                variance_record = {
                    'id': project_id_str,
                    'project_id': project_id_str,
                    'project_name': project_name,
                    'wbs_element': project_name,
                    'total_commitment': budget,
                    'total_actual': actual_cost,
                    'variance': variance,
                    'variance_percentage': variance_percentage,
                    'status': status_val,
                    'organization_id': organization_id
                }
                
                variances.append(variance_record)
                
            except Exception as project_error:
                # Log error but continue processing other projects
                print(f"Error processing project {project.get('id', 'unknown')}: {project_error}")
                continue
        
        # Apply filters
        if project_id:
            variances = [v for v in variances if project_id.lower() in v["project_name"].lower()]
        
        if status:
            variances = [v for v in variances if v['status'] == status]
        
        # Apply limit
        variances = variances[:limit]
        
        # Calculate summary statistics
        total_variances = len(variances)
        over_budget = len([v for v in variances if v.get('status') == 'over'])
        under_budget = len([v for v in variances if v.get('status') == 'under'])
        on_budget = len([v for v in variances if v.get('status') == 'on'])
        
        return {
            "variances": variances,
            "summary": {
                "total_variances": total_variances,
                "over_budget": over_budget,
                "under_budget": under_budget,
                "on_budget": on_budget
            },
            "filters": {
                "organization_id": organization_id,
                "project_id": project_id,
                "status": status,
                "limit": limit
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Get variances error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get variances: {str(e)}")