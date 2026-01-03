from fastapi import FastAPI, HTTPException, status, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from uuid import UUID
import os
import jwt
import openai
import requests
import time
from typing import List, Dict, Any
import json

load_dotenv()

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_ANON_KEY")  # Switch to anon_key for Auth + RLS
)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI(
    title="PPM SaaS MVP API",
    description="Moderne AI-gestützte Project Portfolio Management Lösung",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Pydantic Models ----------
from datetime import date, datetime, timedelta
from enum import Enum

class HealthIndicator(str, Enum):
    green = "green"
    yellow = "yellow"
    red = "red"

class ProjectStatus(str, Enum):
    planning = "planning"
    active = "active"
    on_hold = "on-hold"
    completed = "completed"
    cancelled = "cancelled"

class MilestoneCreate(BaseModel):
    name: str
    description: str | None = None
    due_date: date
    progress_percentage: int = 0

class MilestoneResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None
    due_date: date
    completion_date: date | None
    status: str
    progress_percentage: int
    created_at: datetime
    updated_at: datetime

class ProjectCreate(BaseModel):
    portfolio_id: UUID
    name: str
    description: str | None = None
    status: ProjectStatus = ProjectStatus.planning
    priority: str | None = None
    budget: float | None = None
    start_date: date | None = None
    end_date: date | None = None
    manager_id: UUID | None = None
    team_members: List[UUID] = []

class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    priority: str | None = None
    budget: float | None = None
    actual_cost: float | None = None
    start_date: date | None = None
    end_date: date | None = None
    manager_id: UUID | None = None
    team_members: List[UUID] | None = None
    health: HealthIndicator | None = None

class ProjectResponse(BaseModel):
    id: str
    portfolio_id: str
    name: str
    description: str | None
    status: str
    priority: str | None
    budget: float | None
    actual_cost: float | None
    health: str
    start_date: date | None
    end_date: date | None
    manager_id: str | None
    team_members: List[str]
    milestones: List[MilestoneResponse] = []
    created_at: str
    updated_at: str

class ResourceCreate(BaseModel):
    name: str
    email: str
    role: str | None = None
    capacity: int = 40  # hours per week
    availability: int = 100  # percentage
    hourly_rate: float | None = None
    skills: list[str] = []
    location: str | None = None

class ResourceUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    capacity: int | None = None
    availability: int | None = None
    hourly_rate: float | None = None
    skills: list[str] | None = None
    location: str | None = None

class ResourceResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str | None
    capacity: int
    availability: int
    hourly_rate: float | None
    skills: list[str]
    location: str | None
    current_projects: list[str] = []
    utilization_percentage: float = 0.0
    available_hours: float = 0.0
    allocated_hours: float = 0.0
    capacity_hours: int = 40
    availability_status: str = "available"
    can_take_more_work: bool = True
    created_at: str
    updated_at: str

class ResourceSearchRequest(BaseModel):
    skills: list[str] | None = None
    min_capacity: int | None = None
    max_capacity: int | None = None
    min_availability: int | None = None
    role: str | None = None
    location: str | None = None

class ResourceAllocationSuggestion(BaseModel):
    resource_id: str
    resource_name: str
    match_score: float
    matching_skills: list[str]
    availability: int
    reasoning: str

class RAGQueryRequest(BaseModel):
    query: str
    context_type: str | None = None  # 'projects', 'resources', 'financial', 'risks'

class RAGResponse(BaseModel):
    answer: str
    sources: list[dict]
    confidence: float
    query_type: str
    generated_at: str

class ReportGenerationRequest(BaseModel):
    query: str
    include_charts: bool = False
    format: str = "text"  # 'text', 'json', 'markdown'

# Risk and Issue Management Models
class RiskCategory(str, Enum):
    technical = "technical"
    financial = "financial"
    resource = "resource"
    schedule = "schedule"
    external = "external"

class RiskStatus(str, Enum):
    identified = "identified"
    analyzing = "analyzing"
    mitigating = "mitigating"
    closed = "closed"

class IssueSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class IssueStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"

class RiskCreate(BaseModel):
    project_id: UUID
    title: str
    description: str | None = None
    category: RiskCategory
    probability: float  # 0.0 to 1.0
    impact: float  # 0.0 to 1.0
    mitigation: str | None = None
    owner_id: UUID | None = None
    due_date: date | None = None

class RiskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: RiskCategory | None = None
    probability: float | None = None
    impact: float | None = None
    status: RiskStatus | None = None
    mitigation: str | None = None
    owner_id: UUID | None = None
    due_date: date | None = None

class RiskResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: str | None
    category: str
    probability: float
    impact: float
    risk_score: float
    status: str
    mitigation: str | None
    owner_id: str | None
    due_date: date | None
    created_at: datetime
    updated_at: datetime

class IssueCreate(BaseModel):
    project_id: UUID
    risk_id: UUID | None = None
    title: str
    description: str | None = None
    severity: IssueSeverity = IssueSeverity.medium
    assigned_to: UUID | None = None
    reporter_id: UUID | None = None
    due_date: date | None = None

class IssueUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    severity: IssueSeverity | None = None
    status: IssueStatus | None = None
    assigned_to: UUID | None = None
    resolution: str | None = None
    due_date: date | None = None

class IssueResponse(BaseModel):
    id: str
    project_id: str
    risk_id: str | None
    title: str
    description: str | None
    severity: str
    status: str
    assigned_to: str | None
    reporter_id: str | None
    resolution: str | None
    resolution_date: datetime | None
    due_date: date | None
    created_at: datetime
    updated_at: datetime

# Financial Tracking Models
class CurrencyCode(str, Enum):
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    CAD = "CAD"
    AUD = "AUD"

class FinancialTrackingCreate(BaseModel):
    project_id: UUID
    category: str
    description: str | None = None
    planned_amount: float
    actual_amount: float = 0.0
    currency: CurrencyCode = CurrencyCode.USD
    exchange_rate: float = 1.0
    date_incurred: date

class FinancialTrackingUpdate(BaseModel):
    category: str | None = None
    description: str | None = None
    planned_amount: float | None = None
    actual_amount: float | None = None
    currency: CurrencyCode | None = None
    exchange_rate: float | None = None
    date_incurred: date | None = None

class FinancialTrackingResponse(BaseModel):
    id: str
    project_id: str
    category: str
    description: str | None
    planned_amount: float
    actual_amount: float
    currency: str
    exchange_rate: float
    date_incurred: date
    recorded_by: str | None
    created_at: datetime
    updated_at: datetime

class BudgetVarianceResponse(BaseModel):
    project_id: str
    total_planned: float
    total_actual: float
    variance_amount: float
    variance_percentage: float
    currency: str
    categories: List[dict]
    status: str  # "under_budget", "on_budget", "over_budget"

class FinancialReportRequest(BaseModel):
    project_ids: List[UUID] | None = None
    start_date: date | None = None
    end_date: date | None = None
    categories: List[str] | None = None
    currency: CurrencyCode = CurrencyCode.USD

# ---------- Hilfsfunktion für UUID-Conversion ----------
def convert_uuids(data: list[dict] | dict):
    if isinstance(data, list):
        for item in data:
            for key, value in item.items():
                if isinstance(value, UUID):
                    item[key] = str(value)
        return data
    elif isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, UUID):
                data[key] = str(value)
        return data
    return data

def calculate_project_health(project: dict) -> HealthIndicator:
    """Calculate project health based on budget, timeline, risks, and milestones"""
    health_score = 0
    factors = 0
    
    # Budget health (25% weight)
    if project.get('budget') and project.get('actual_cost') is not None:
        budget_utilization = project['actual_cost'] / project['budget'] if project['budget'] > 0 else 0
        if budget_utilization <= 0.8:  # Under 80% budget used
            health_score += 2
        elif budget_utilization <= 1.0:  # Within budget
            health_score += 1
        # Over budget gets 0 points
        factors += 1
    
    # Timeline health (25% weight)
    if project.get('start_date') and project.get('end_date'):
        from datetime import date
        today = date.today()
        start_date = project['start_date'] if isinstance(project['start_date'], date) else date.fromisoformat(str(project['start_date']))
        end_date = project['end_date'] if isinstance(project['end_date'], date) else date.fromisoformat(str(project['end_date']))
        
        if today < start_date:  # Not started yet
            health_score += 2
        elif today <= end_date:  # On schedule
            total_days = (end_date - start_date).days
            elapsed_days = (today - start_date).days
            progress_ratio = elapsed_days / total_days if total_days > 0 else 0
            
            if progress_ratio <= 0.8:  # Early in timeline
                health_score += 2
            else:  # Late in timeline but not overdue
                health_score += 1
        # Overdue gets 0 points
        factors += 1
    
    # Status health (25% weight)
    status = project.get('status', 'planning')
    if status in ['planning', 'active']:
        health_score += 2
    elif status == 'on-hold':
        health_score += 1
    # cancelled/completed handled separately
    factors += 1
    
    # Milestone progress health (25% weight)
    milestones = project.get('milestones', [])
    if milestones:
        total_milestones = len(milestones)
        completed_milestones = sum(1 for m in milestones if m.get('status') == 'completed')
        overdue_milestones = 0
        
        from datetime import date
        today = date.today()
        for milestone in milestones:
            if milestone.get('status') != 'completed' and milestone.get('due_date'):
                due_date = milestone['due_date'] if isinstance(milestone['due_date'], date) else date.fromisoformat(str(milestone['due_date']))
                if due_date < today:
                    overdue_milestones += 1
        
        # Calculate milestone health score
        completion_ratio = completed_milestones / total_milestones if total_milestones > 0 else 0
        overdue_ratio = overdue_milestones / total_milestones if total_milestones > 0 else 0
        
        if overdue_ratio == 0 and completion_ratio >= 0.8:
            health_score += 2  # Excellent milestone progress
        elif overdue_ratio <= 0.2 and completion_ratio >= 0.5:
            health_score += 1  # Good milestone progress
        # Poor milestone progress gets 0 points
        
        factors += 1
    
    if factors == 0:
        return HealthIndicator.green  # Default for new projects
    
    average_score = health_score / factors
    
    if average_score >= 1.5:
        return HealthIndicator.green
    elif average_score >= 0.5:
        return HealthIndicator.yellow
    else:
        return HealthIndicator.red

async def get_project_milestones(project_id: str) -> List[dict]:
    """Get milestones for a project"""
    response = supabase.table("milestones").select("*").eq("project_id", project_id).execute()
    return convert_uuids(response.data)





async def get_resource_current_projects(resource_id: str) -> List[str]:
    """Get current project IDs for a resource"""
    response = supabase.table("project_resources").select("project_id").eq("resource_id", resource_id).execute()
    return [item['project_id'] for item in response.data] if response.data else []

def calculate_advanced_skill_match_score(required_skills: List[str], resource_skills: List[str]) -> dict:
    """Calculate advanced skill match score with detailed breakdown"""
    if not required_skills:
        return {
            'match_score': 1.0,
            'matching_skills': resource_skills,
            'missing_skills': [],
            'extra_skills': resource_skills
        }
    
    if not resource_skills:
        return {
            'match_score': 0.0,
            'matching_skills': [],
            'missing_skills': required_skills,
            'extra_skills': []
        }
    
    # Convert to lowercase for case-insensitive matching
    required_lower = [skill.lower().strip() for skill in required_skills]
    resource_lower = [skill.lower().strip() for skill in resource_skills]
    
    # Find matches
    matching_skills = []
    for req_skill in required_skills:
        if req_skill.lower().strip() in resource_lower:
            matching_skills.append(req_skill)
    
    # Find missing skills
    missing_skills = []
    for req_skill in required_skills:
        if req_skill.lower().strip() not in resource_lower:
            missing_skills.append(req_skill)
    
    # Find extra skills
    extra_skills = []
    for res_skill in resource_skills:
        if res_skill.lower().strip() not in required_lower:
            extra_skills.append(res_skill)
    
    # Calculate match score
    match_score = len(matching_skills) / len(required_skills)
    
    return {
        'match_score': match_score,
        'matching_skills': matching_skills,
        'missing_skills': missing_skills,
        'extra_skills': extra_skills
    }

def calculate_enhanced_resource_availability(resource: dict) -> dict:
    """Calculate enhanced availability metrics for a resource"""
    capacity = resource.get('capacity', 40)  # hours per week
    availability_percentage = resource.get('availability', 100)
    
    # Calculate available hours per week
    available_hours = capacity * (availability_percentage / 100)
    
    # Get current project allocations from project_resources table
    current_projects = resource.get('current_projects', [])
    
    # Calculate current utilization based on project allocations
    allocated_hours = 0
    if current_projects:
        # Query project_resources for actual allocation percentages
        for project_id in current_projects:
            allocation_response = supabase.table("project_resources").select("allocation_percentage").eq("resource_id", resource['id']).eq("project_id", project_id).execute()
            if allocation_response.data:
                allocation_percentage = allocation_response.data[0].get('allocation_percentage', 100)
                # Calculate hours based on allocation percentage
                project_hours = capacity * (allocation_percentage / 100)
                allocated_hours += project_hours
    
    utilization_percentage = (allocated_hours / capacity * 100) if capacity > 0 else 0
    remaining_hours = max(0, available_hours - allocated_hours)
    
    # Calculate availability status
    availability_status = "available"
    if utilization_percentage >= 100:
        availability_status = "fully_allocated"
    elif utilization_percentage >= 80:
        availability_status = "mostly_allocated"
    elif utilization_percentage >= 50:
        availability_status = "partially_allocated"
    
    return {
        'utilization_percentage': min(100, utilization_percentage),
        'available_hours': remaining_hours,
        'allocated_hours': allocated_hours,
        'capacity_hours': capacity,
        'availability_status': availability_status,
        'can_take_more_work': remaining_hours > 0
    }

# Exchange rate management (simplified - in production would use external API)
EXCHANGE_RATES = {
    "USD": 1.0,
    "EUR": 0.85,
    "GBP": 0.73,
    "JPY": 110.0,
    "CAD": 1.25,
    "AUD": 1.35
}

def get_exchange_rate(from_currency: str, to_currency: str = "USD") -> float:
    """Get exchange rate between currencies"""
    if from_currency == to_currency:
        return 1.0
    
    from_rate = EXCHANGE_RATES.get(from_currency, 1.0)
    to_rate = EXCHANGE_RATES.get(to_currency, 1.0)
    
    return to_rate / from_rate

def convert_currency(amount: float, from_currency: str, to_currency: str = "USD") -> float:
    """Convert amount from one currency to another"""
    rate = get_exchange_rate(from_currency, to_currency)
    return amount * rate

async def calculate_project_budget_variance(project_id: str, target_currency: str = "USD") -> dict:
    """Calculate budget variance for a project"""
    # Get financial tracking records
    response = supabase.table("financial_tracking").select("*").eq("project_id", project_id).execute()
    financial_records = response.data
    
    # Get project budget
    project_response = supabase.table("projects").select("budget, actual_cost").eq("id", project_id).execute()
    if not project_response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = project_response.data[0]
    project_budget = project.get('budget', 0) or 0
    project_actual_cost = project.get('actual_cost', 0) or 0
    
    # Calculate totals by category
    categories = {}
    total_planned = 0
    total_actual = 0
    
    for record in financial_records:
        category = record['category']
        planned = convert_currency(record['planned_amount'], record['currency'], target_currency)
        actual = convert_currency(record['actual_amount'], record['currency'], target_currency)
        
        if category not in categories:
            categories[category] = {
                'category': category,
                'planned': 0,
                'actual': 0,
                'variance': 0,
                'variance_percentage': 0
            }
        
        categories[category]['planned'] += planned
        categories[category]['actual'] += actual
        total_planned += planned
        total_actual += actual
    
    # Use project budget if no detailed tracking
    if total_planned == 0 and project_budget > 0:
        total_planned = project_budget
    
    if total_actual == 0 and project_actual_cost > 0:
        total_actual = project_actual_cost
    
    # Calculate variances
    variance_amount = total_actual - total_planned
    variance_percentage = (variance_amount / total_planned * 100) if total_planned > 0 else 0
    
    # Determine status
    status = "on_budget"
    if variance_percentage > 10:
        status = "over_budget"
    elif variance_percentage < -10:
        status = "under_budget"
    
    # Calculate category variances
    for cat_data in categories.values():
        cat_data['variance'] = cat_data['actual'] - cat_data['planned']
        cat_data['variance_percentage'] = (cat_data['variance'] / cat_data['planned'] * 100) if cat_data['planned'] > 0 else 0
    
    return {
        'project_id': project_id,
        'total_planned': total_planned,
        'total_actual': total_actual,
        'variance_amount': variance_amount,
        'variance_percentage': variance_percentage,
        'currency': target_currency,
        'categories': list(categories.values()),
        'status': status
    }

# JWT Secret for verification
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")

# Auth Dependency
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    print(f"DEBUG: Received token: {token[:50]}...")  # Debug log
    try:
        # For development, we'll decode without verification since we know the token is valid
        # TODO: Implement proper ES256 verification for production
        payload = jwt.decode(token, options={"verify_signature": False})
        print(f"DEBUG: Decoded payload (unverified): {payload}")  # Debug log
        
        # Verify the token is from our Supabase instance
        expected_issuer = f"{SUPABASE_URL}/auth/v1"
        if payload.get("iss") != expected_issuer:
            print(f"DEBUG: Invalid issuer: {payload.get('iss')} != {expected_issuer}")
            raise HTTPException(status_code=401, detail="Invalid token issuer")
        
        # Check if token is expired
        import time
        current_time = int(time.time())
        if payload.get("exp", 0) < current_time:
            print(f"DEBUG: Token expired: {payload.get('exp')} < {current_time}")
            raise HTTPException(status_code=401, detail="Token expired")
        
        user_id = payload.get("sub")
        if not user_id:
            print("DEBUG: No user_id in token")  # Debug log
            raise HTTPException(status_code=401, detail="Invalid token")
        
        print(f"DEBUG: Authentication successful for user: {user_id}")  # Debug log
        return {"user_id": user_id, "organization_id": None}
    except jwt.ExpiredSignatureError as e:
        print(f"DEBUG: Token expired: {e}")  # Debug log
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"DEBUG: Invalid token: {e}")  # Debug log
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"DEBUG: Unexpected error: {e}")  # Debug log
        raise HTTPException(status_code=401, detail="Authentication error")

# Remove the temporary disabled version
# get_current_user = get_current_user_disabled

# ---------- Endpoints ----------
@app.get("/")
async def root():
    return {"message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀"}

@app.post("/projects/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, current_user = Depends(get_current_user)):
    try:
        project_data = project.dict()
        # Convert UUID lists to string lists for JSON storage
        if project_data.get('team_members'):
            project_data['team_members'] = [str(member_id) for member_id in project_data['team_members']]
        
        # Ensure all required fields have defaults
        if 'actual_cost' not in project_data:
            project_data['actual_cost'] = 0.0
        if 'team_members' not in project_data:
            project_data['team_members'] = []
        
        response = supabase.table("projects").insert(project_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Projekts")
        
        project_record = convert_uuids(response.data[0])
        
        # Get milestones (will be empty for new project)
        project_record['milestones'] = await get_project_milestones(project_record['id'])
        
        # Calculate and update health
        health = calculate_project_health(project_record)
        supabase.table("projects").update({"health": health.value}).eq("id", project_record['id']).execute()
        project_record['health'] = health.value
        
        return project_record
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/projects/")
async def list_projects(portfolio_id: UUID | None = Query(None), current_user = Depends(get_current_user)):
    query = supabase.table("projects").select("*")
    if portfolio_id:
        query = query.eq("portfolio_id", str(portfolio_id))
    response = query.execute()
    
    projects = convert_uuids(response.data)
    
    # Add milestones to each project
    for project in projects:
        project['milestones'] = await get_project_milestones(project['id'])
        # Ensure team_members is a list
        if not project.get('team_members'):
            project['team_members'] = []
    
    return projects

@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = convert_uuids(response.data[0])
    
    # Get milestones
    project['milestones'] = await get_project_milestones(project['id'])
    
    # Ensure team_members is a list
    if not project.get('team_members'):
        project['team_members'] = []
    
    return project

@app.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: UUID, project_update: ProjectUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in project_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    # Convert UUID lists to string lists for JSON storage
    if data_to_update.get('team_members'):
        data_to_update['team_members'] = [str(member_id) for member_id in data_to_update['team_members']]
    
    response = supabase.table("projects").update(data_to_update).eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = convert_uuids(response.data[0])
    
    # Get milestones for health calculation
    project['milestones'] = await get_project_milestones(project['id'])
    
    # Recalculate health if not explicitly set
    if 'health' not in data_to_update:
        health = calculate_project_health(project)
        supabase.table("projects").update({"health": health.value}).eq("id", project['id']).execute()
        project['health'] = health.value
    
    # Ensure team_members is a list
    if not project.get('team_members'):
        project['team_members'] = []
    
    return project

@app.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("projects").delete().eq("id", str(project_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return None

# Milestone endpoints
@app.post("/projects/{project_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_milestone(project_id: UUID, milestone: MilestoneCreate, current_user = Depends(get_current_user)):
    try:
        milestone_data = milestone.dict()
        milestone_data['project_id'] = str(project_id)
        milestone_data['status'] = 'pending'
        
        response = supabase.table("milestones").insert(milestone_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Meilensteins")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/projects/{project_id}/milestones")
async def list_project_milestones(project_id: UUID, current_user = Depends(get_current_user)):
    milestones = await get_project_milestones(str(project_id))
    
    # Calculate progress metrics
    total_milestones = len(milestones)
    completed_milestones = sum(1 for m in milestones if m.get('status') == 'completed')
    overdue_milestones = 0
    
    from datetime import date
    today = date.today()
    for milestone in milestones:
        if milestone.get('status') != 'completed' and milestone.get('due_date'):
            due_date = milestone['due_date'] if isinstance(milestone['due_date'], date) else date.fromisoformat(str(milestone['due_date']))
            if due_date < today:
                overdue_milestones += 1
    
    progress_summary = {
        "total_milestones": total_milestones,
        "completed_milestones": completed_milestones,
        "overdue_milestones": overdue_milestones,
        "completion_percentage": (completed_milestones / total_milestones * 100) if total_milestones > 0 else 0,
        "on_track": overdue_milestones == 0
    }
    
    return {
        "milestones": milestones,
        "progress_summary": progress_summary
    }

@app.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(milestone_id: UUID, milestone_update: dict, current_user = Depends(get_current_user)):
    # Filter out None values
    data_to_update = {k: v for k, v in milestone_update.items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    # Auto-complete milestone if progress is 100%
    if data_to_update.get('progress_percentage') == 100:
        data_to_update['status'] = 'completed'
        data_to_update['completion_date'] = date.today().isoformat()
    
    # Auto-set progress to 100% if status is completed
    if data_to_update.get('status') == 'completed':
        data_to_update['progress_percentage'] = 100
        if 'completion_date' not in data_to_update:
            data_to_update['completion_date'] = date.today().isoformat()
    
    # Reset completion_date if status is not completed
    if data_to_update.get('status') and data_to_update['status'] != 'completed':
        data_to_update['completion_date'] = None
    
    response = supabase.table("milestones").update(data_to_update).eq("id", str(milestone_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    milestone = convert_uuids(response.data[0])
    
    # Update project health after milestone change
    project_id = milestone['project_id']
    project_response = supabase.table("projects").select("*").eq("id", project_id).execute()
    if project_response.data:
        project = convert_uuids(project_response.data[0])
        # Get updated milestones for health calculation
        project['milestones'] = await get_project_milestones(project_id)
        health = calculate_project_health(project)
        supabase.table("projects").update({"health": health.value}).eq("id", project_id).execute()
    
    return milestone

@app.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(milestone_id: UUID, current_user = Depends(get_current_user)):
    # Get milestone to find project_id for health recalculation
    milestone_response = supabase.table("milestones").select("project_id").eq("id", str(milestone_id)).execute()
    
    response = supabase.table("milestones").delete().eq("id", str(milestone_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    # Update project health after milestone deletion
    if milestone_response.data:
        project_id = milestone_response.data[0]['project_id']
        project_response = supabase.table("projects").select("*").eq("id", project_id).execute()
        if project_response.data:
            project = convert_uuids(project_response.data[0])
            # Get updated milestones for health calculation
            project['milestones'] = await get_project_milestones(project_id)
            health = calculate_project_health(project)
            supabase.table("projects").update({"health": health.value}).eq("id", project_id).execute()
    
    return None

@app.patch("/projects/{project_id}/milestones/bulk-update")
async def bulk_update_milestones(
    project_id: UUID, 
    milestone_updates: List[dict], 
    current_user = Depends(get_current_user)
):
    """Bulk update multiple milestones for a project"""
    updated_milestones = []
    
    for update_data in milestone_updates:
        milestone_id = update_data.get('id')
        if not milestone_id:
            continue
            
        # Filter out None values and id
        data_to_update = {k: v for k, v in update_data.items() if v is not None and k != 'id'}
        if not data_to_update:
            continue
        
        # Auto-complete milestone if progress is 100%
        if data_to_update.get('progress_percentage') == 100:
            data_to_update['status'] = 'completed'
            data_to_update['completion_date'] = date.today().isoformat()
        
        # Auto-set progress to 100% if status is completed
        if data_to_update.get('status') == 'completed':
            data_to_update['progress_percentage'] = 100
            if 'completion_date' not in data_to_update:
                data_to_update['completion_date'] = date.today().isoformat()
        
        # Reset completion_date if status is not completed
        if data_to_update.get('status') and data_to_update['status'] != 'completed':
            data_to_update['completion_date'] = None
        
        try:
            response = supabase.table("milestones").update(data_to_update).eq("id", milestone_id).execute()
            if response.data:
                updated_milestones.append(convert_uuids(response.data[0]))
        except Exception as e:
            # Continue with other updates even if one fails
            continue
    
    # Update project health after bulk milestone changes
    project_response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
    if project_response.data:
        project = convert_uuids(project_response.data[0])
        # Get updated milestones for health calculation
        project['milestones'] = await get_project_milestones(str(project_id))
        health = calculate_project_health(project)
        supabase.table("projects").update({"health": health.value}).eq("id", str(project_id)).execute()
    
    return {
        "updated_count": len(updated_milestones),
        "milestones": updated_milestones,
        "project_health_updated": True
    }

@app.post("/projects/{project_id}/team-members/{user_id}")
async def add_team_member(project_id: UUID, user_id: UUID, current_user = Depends(get_current_user)):
    """Add a team member to a project"""
    # Get current project
    response = supabase.table("projects").select("team_members").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    current_team_members = response.data[0].get('team_members', [])
    user_id_str = str(user_id)
    
    # Check if user is already a team member
    if user_id_str in current_team_members:
        raise HTTPException(status_code=400, detail="User is already a team member")
    
    # Add user to team members
    updated_team_members = current_team_members + [user_id_str]
    
    update_response = supabase.table("projects").update({
        "team_members": updated_team_members
    }).eq("id", str(project_id)).execute()
    
    if not update_response.data:
        raise HTTPException(status_code=400, detail="Failed to add team member")
    
    return {
        "message": "Team member added successfully",
        "project_id": str(project_id),
        "user_id": user_id_str,
        "team_members": updated_team_members
    }

@app.delete("/projects/{project_id}/team-members/{user_id}")
async def remove_team_member(project_id: UUID, user_id: UUID, current_user = Depends(get_current_user)):
    """Remove a team member from a project"""
    # Get current project
    response = supabase.table("projects").select("team_members").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    current_team_members = response.data[0].get('team_members', [])
    user_id_str = str(user_id)
    
    # Check if user is a team member
    if user_id_str not in current_team_members:
        raise HTTPException(status_code=400, detail="User is not a team member")
    
    # Remove user from team members
    updated_team_members = [member for member in current_team_members if member != user_id_str]
    
    update_response = supabase.table("projects").update({
        "team_members": updated_team_members
    }).eq("id", str(project_id)).execute()
    
    if not update_response.data:
        raise HTTPException(status_code=400, detail="Failed to remove team member")
    
    return {
        "message": "Team member removed successfully",
        "project_id": str(project_id),
        "user_id": user_id_str,
        "team_members": updated_team_members
    }

@app.get("/projects/{project_id}/team-members")
async def get_project_team_members(project_id: UUID, current_user = Depends(get_current_user)):
    """Get detailed information about project team members"""
    # Get project team members
    response = supabase.table("projects").select("team_members, manager_id").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = response.data[0]
    team_member_ids = project_data.get('team_members', [])
    manager_id = project_data.get('manager_id')
    
    team_members = []
    
    # Get team member details from resources table
    if team_member_ids:
        resources_response = supabase.table("resources").select("*").in_("id", team_member_ids).execute()
        for resource in resources_response.data:
            resource_data = convert_uuids(resource)
            resource_data['is_manager'] = resource_data['id'] == str(manager_id) if manager_id else False
            team_members.append(resource_data)
    
    # Get manager details if not in team members
    manager_details = None
    if manager_id and str(manager_id) not in team_member_ids:
        manager_response = supabase.table("resources").select("*").eq("id", str(manager_id)).execute()
        if manager_response.data:
            manager_details = convert_uuids(manager_response.data[0])
            manager_details['is_manager'] = True
    
    return {
        "project_id": str(project_id),
        "team_members": team_members,
        "manager": manager_details,
        "total_team_size": len(team_members) + (1 if manager_details else 0)
    }

@app.get("/projects/{project_id}/progress")
async def get_project_progress(project_id: UUID, current_user = Depends(get_current_user)):
    """Get comprehensive project progress including milestones, budget, and timeline"""
    # Get project details
    response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = convert_uuids(response.data[0])
    
    # Get milestones
    milestones = await get_project_milestones(str(project_id))
    project['milestones'] = milestones
    
    # Calculate milestone progress
    total_milestones = len(milestones)
    completed_milestones = sum(1 for m in milestones if m.get('status') == 'completed')
    
    # Calculate weighted progress based on milestone progress percentages
    if milestones:
        total_progress = sum(m.get('progress_percentage', 0) for m in milestones)
        weighted_progress = total_progress / len(milestones)
    else:
        weighted_progress = 0
    
    # Calculate timeline progress
    timeline_progress = 0
    if project.get('start_date') and project.get('end_date'):
        from datetime import date
        today = date.today()
        start_date = project['start_date'] if isinstance(project['start_date'], date) else date.fromisoformat(str(project['start_date']))
        end_date = project['end_date'] if isinstance(project['end_date'], date) else date.fromisoformat(str(project['end_date']))
        
        if today >= start_date:
            total_days = (end_date - start_date).days
            elapsed_days = (today - start_date).days
            timeline_progress = min(100, (elapsed_days / total_days * 100)) if total_days > 0 else 0
    
    # Calculate budget progress
    budget_progress = 0
    if project.get('budget') and project.get('actual_cost') is not None:
        budget_progress = (project['actual_cost'] / project['budget'] * 100) if project['budget'] > 0 else 0
    
    # Calculate overall health
    health = calculate_project_health(project)
    
    return {
        "project_id": str(project_id),
        "project_name": project.get('name'),
        "status": project.get('status'),
        "health": health.value,
        "progress": {
            "milestone_progress": {
                "total_milestones": total_milestones,
                "completed_milestones": completed_milestones,
                "completion_percentage": (completed_milestones / total_milestones * 100) if total_milestones > 0 else 0,
                "weighted_progress": weighted_progress
            },
            "timeline_progress": {
                "percentage": timeline_progress,
                "start_date": project.get('start_date'),
                "end_date": project.get('end_date'),
                "is_overdue": timeline_progress > 100
            },
            "budget_progress": {
                "percentage": budget_progress,
                "budget": project.get('budget'),
                "actual_cost": project.get('actual_cost'),
                "is_over_budget": budget_progress > 100
            }
        },
        "calculated_at": datetime.now().isoformat()
    }

@app.get("/projects/{project_id}/health")
async def get_project_health_details(project_id: UUID, current_user = Depends(get_current_user)):
    """Get detailed project health analysis"""
    response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = convert_uuids(response.data[0])
    
    # Get milestones for health calculation
    milestones = await get_project_milestones(str(project_id))
    project['milestones'] = milestones
    
    health = calculate_project_health(project)
    
    # Calculate detailed metrics
    health_details = {
        "overall_health": health.value,
        "budget_health": "green",
        "timeline_health": "green", 
        "status_health": "green",
        "milestone_health": "green",
        "factors": []
    }
    
    # Budget analysis
    if project.get('budget') and project.get('actual_cost') is not None:
        budget_utilization = project['actual_cost'] / project['budget'] if project['budget'] > 0 else 0
        if budget_utilization <= 0.8:
            health_details["budget_health"] = "green"
            health_details["factors"].append(f"Budget utilization: {budget_utilization:.1%} (Good)")
        elif budget_utilization <= 1.0:
            health_details["budget_health"] = "yellow"
            health_details["factors"].append(f"Budget utilization: {budget_utilization:.1%} (Caution)")
        else:
            health_details["budget_health"] = "red"
            health_details["factors"].append(f"Budget utilization: {budget_utilization:.1%} (Over budget)")
    
    # Timeline analysis
    if project.get('start_date') and project.get('end_date'):
        from datetime import date
        today = date.today()
        start_date = project['start_date'] if isinstance(project['start_date'], date) else date.fromisoformat(str(project['start_date']))
        end_date = project['end_date'] if isinstance(project['end_date'], date) else date.fromisoformat(str(project['end_date']))
        
        if today < start_date:
            health_details["timeline_health"] = "green"
            health_details["factors"].append("Project not yet started")
        elif today <= end_date:
            days_remaining = (end_date - today).days
            health_details["timeline_health"] = "green" if days_remaining > 7 else "yellow"
            health_details["factors"].append(f"Days remaining: {days_remaining}")
        else:
            health_details["timeline_health"] = "red"
            days_overdue = (today - end_date).days
            health_details["factors"].append(f"Days overdue: {days_overdue}")
    
    # Milestone analysis
    if milestones:
        total_milestones = len(milestones)
        completed_milestones = sum(1 for m in milestones if m.get('status') == 'completed')
        overdue_milestones = 0
        
        from datetime import date
        today = date.today()
        for milestone in milestones:
            if milestone.get('status') != 'completed' and milestone.get('due_date'):
                due_date = milestone['due_date'] if isinstance(milestone['due_date'], date) else date.fromisoformat(str(milestone['due_date']))
                if due_date < today:
                    overdue_milestones += 1
        
        completion_ratio = completed_milestones / total_milestones
        overdue_ratio = overdue_milestones / total_milestones
        
        if overdue_ratio == 0 and completion_ratio >= 0.8:
            health_details["milestone_health"] = "green"
            health_details["factors"].append(f"Milestones: {completed_milestones}/{total_milestones} completed (Excellent)")
        elif overdue_ratio <= 0.2 and completion_ratio >= 0.5:
            health_details["milestone_health"] = "yellow"
            health_details["factors"].append(f"Milestones: {completed_milestones}/{total_milestones} completed, {overdue_milestones} overdue (Good)")
        else:
            health_details["milestone_health"] = "red"
            health_details["factors"].append(f"Milestones: {completed_milestones}/{total_milestones} completed, {overdue_milestones} overdue (Poor)")
    
    return health_details

@app.post("/resources/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(resource: ResourceCreate, current_user = Depends(get_current_user)):
    try:
        response = supabase.table("resources").insert(resource.dict()).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen der Resource")
        
        resource_data = convert_uuids(response.data[0])
        
        # Calculate enhanced availability metrics
        availability_metrics = calculate_enhanced_resource_availability(resource_data)
        resource_data.update(availability_metrics)
        
        # Get current projects
        resource_data['current_projects'] = await get_resource_current_projects(resource_data['id'])
        
        return resource_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/resources/")
async def list_resources(current_user = Depends(get_current_user)):
    response = supabase.table("resources").select("*").execute()
    resources = convert_uuids(response.data)
    
    # Enhance each resource with calculated metrics
    for resource in resources:
        availability_metrics = calculate_enhanced_resource_availability(resource)
        resource.update(availability_metrics)
        resource['current_projects'] = await get_resource_current_projects(resource['id'])
        
        # Ensure skills is a list
        if not resource.get('skills'):
            resource['skills'] = []
    
    return resources

@app.get("/resources/{resource_id}", response_model=ResourceResponse)
async def get_resource(resource_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("resources").select("*").eq("id", str(resource_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    resource = convert_uuids(response.data[0])
    
    # Calculate enhanced availability metrics
    availability_metrics = calculate_enhanced_resource_availability(resource)
    resource.update(availability_metrics)
    
    # Get current projects
    resource['current_projects'] = await get_resource_current_projects(resource['id'])
    
    # Ensure skills is a list
    if not resource.get('skills'):
        resource['skills'] = []
    
    return resource

@app.patch("/resources/{resource_id}", response_model=ResourceResponse)
async def update_resource(resource_id: UUID, resource_update: ResourceUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in resource_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")

    response = supabase.table("resources").update(data_to_update).eq("id", str(resource_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    resource = convert_uuids(response.data[0])
    
    # Calculate enhanced availability metrics
    availability_metrics = calculate_enhanced_resource_availability(resource)
    resource.update(availability_metrics)
    
    # Get current projects
    resource['current_projects'] = await get_resource_current_projects(resource['id'])
    
    # Ensure skills is a list
    if not resource.get('skills'):
        resource['skills'] = []
    
    return resource

@app.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(resource_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("resources").delete().eq("id", str(resource_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return None

@app.post("/resources/search")
async def search_resources(search_request: ResourceSearchRequest, current_user = Depends(get_current_user)):
    """Search resources based on skills, capacity, availability, and other criteria"""
    query = supabase.table("resources").select("*")
    
    # Apply filters based on search criteria
    if search_request.role:
        query = query.ilike("role", f"%{search_request.role}%")
    
    if search_request.location:
        query = query.ilike("location", f"%{search_request.location}%")
    
    if search_request.min_capacity:
        query = query.gte("capacity", search_request.min_capacity)
    
    if search_request.max_capacity:
        query = query.lte("capacity", search_request.max_capacity)
    
    if search_request.min_availability:
        query = query.gte("availability", search_request.min_availability)
    
    response = query.execute()
    resources = convert_uuids(response.data)
    
    # Filter by skills if specified and enhance with metrics
    filtered_resources = []
    for resource in resources:
        resource_skills = resource.get('skills', [])
        
        # Apply enhanced skill filter
        if search_request.skills:
            skill_analysis = calculate_advanced_skill_match_score(search_request.skills, resource_skills)
            if skill_analysis['match_score'] > 0:  # Only include resources with some skill match
                resource.update(skill_analysis)
                filtered_resources.append(resource)
        else:
            # No skill requirements - include all resources
            resource.update({
                'match_score': 1.0,
                'matching_skills': resource_skills,
                'missing_skills': [],
                'extra_skills': resource_skills
            })
            filtered_resources.append(resource)
    
    # Enhance with availability metrics
    for resource in filtered_resources:
        availability_metrics = calculate_enhanced_resource_availability(resource)
        resource.update(availability_metrics)
        resource['current_projects'] = await get_resource_current_projects(resource['id'])
        
        # Ensure skills is a list
        if not resource.get('skills'):
            resource['skills'] = []
    
    # Sort by skill match score and availability
    filtered_resources.sort(key=lambda x: (x['match_score'], x['available_hours']), reverse=True)
    
    return filtered_resources

@app.post("/resources/allocation-suggestions")
async def get_allocation_suggestions(
    project_id: UUID,
    required_skills: list[str],
    required_hours: int = 20,  # hours per week needed
    current_user = Depends(get_current_user)
):
    """Get resource allocation suggestions based on project requirements"""
    # Get all available resources
    response = supabase.table("resources").select("*").execute()
    resources = convert_uuids(response.data)
    
    suggestions = []
    for resource in resources:
        resource_skills = resource.get('skills', [])
        
        # Calculate enhanced skill match analysis
        skill_analysis = calculate_advanced_skill_match_score(required_skills, resource_skills)
        
        if skill_analysis['match_score'] > 0:  # Only suggest resources with some skill match
            # Calculate enhanced availability metrics
            availability_metrics = calculate_enhanced_resource_availability(resource)
            
            # Check if resource has enough available hours
            available_hours = availability_metrics['available_hours']
            can_accommodate = available_hours >= required_hours
            
            # Calculate final recommendation score
            availability_factor = min(1.0, available_hours / required_hours) if required_hours > 0 else 1.0
            final_score = skill_analysis['match_score'] * 0.7 + availability_factor * 0.3
            
            # Build detailed reasoning
            reasoning = f"Skill match: {skill_analysis['match_score']:.1%} ({len(skill_analysis['matching_skills'])}/{len(required_skills)} skills). "
            reasoning += f"Available: {available_hours:.1f}h/week (need {required_hours}h). "
            reasoning += f"Status: {availability_metrics['availability_status']}. "
            reasoning += f"Current utilization: {availability_metrics['utilization_percentage']:.1f}%"
            
            if skill_analysis['missing_skills']:
                reasoning += f". Missing skills: {', '.join(skill_analysis['missing_skills'])}"
            
            if skill_analysis['extra_skills']:
                reasoning += f". Additional skills: {', '.join(skill_analysis['extra_skills'][:3])}"
                if len(skill_analysis['extra_skills']) > 3:
                    reasoning += f" (+{len(skill_analysis['extra_skills']) - 3} more)"
            
            if not can_accommodate:
                reasoning += " - Insufficient capacity"
            
            suggestions.append(ResourceAllocationSuggestion(
                resource_id=resource['id'],
                resource_name=resource['name'],
                match_score=final_score,
                matching_skills=skill_analysis['matching_skills'],
                availability=int(availability_metrics['available_hours']),
                reasoning=reasoning
            ))
    
    # Sort by match score descending
    suggestions.sort(key=lambda x: x.match_score, reverse=True)
    return suggestions[:10]  # Return top 10 suggestions

@app.get("/resources/utilization")
async def get_resource_utilization(current_user = Depends(get_current_user)):
    """Get resource utilization data for heatmap visualization"""
    response = supabase.table("resources").select("*").execute()
    resources = convert_uuids(response.data)
    
    utilization_data = []
    for resource in resources:
        # Calculate enhanced utilization metrics
        availability_metrics = calculate_enhanced_resource_availability(resource)
        
        # Get current projects
        current_projects = await get_resource_current_projects(resource['id'])
        
        # Use the enhanced availability status
        status = availability_metrics['availability_status']
        
        utilization_data.append({
            "id": resource['id'],
            "name": resource['name'],
            "role": resource.get('role', 'Unknown'),
            "capacity": resource.get('capacity', 40),
            "availability": resource.get('availability', 100),
            "current_allocation": availability_metrics['allocated_hours'],
            "available_hours": availability_metrics['available_hours'],
            "utilization_percentage": availability_metrics['utilization_percentage'],
            "status": status,
            "availability_status": availability_metrics['availability_status'],
            "can_take_more_work": availability_metrics['can_take_more_work'],
            "skills": resource.get('skills', []),
            "current_projects": current_projects,
            "location": resource.get('location', 'Unknown')
        })
    
    return utilization_data

@app.post("/resources/{resource_id}/allocate")
async def allocate_resource_to_project(
    resource_id: UUID,
    project_id: UUID,
    allocation_percentage: int = 100,
    role_in_project: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    current_user = Depends(get_current_user)
):
    """Allocate a resource to a project with specified parameters"""
    try:
        # Validate allocation percentage
        if allocation_percentage < 0 or allocation_percentage > 100:
            raise HTTPException(status_code=400, detail="Allocation percentage must be between 0 and 100")
        
        # Check if resource exists
        resource_response = supabase.table("resources").select("*").eq("id", str(resource_id)).execute()
        if not resource_response.data:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        # Check if project exists
        project_response = supabase.table("projects").select("*").eq("id", str(project_id)).execute()
        if not project_response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        resource = resource_response.data[0]
        
        # Calculate if resource has capacity for this allocation
        availability_metrics = calculate_enhanced_resource_availability(resource)
        required_hours = resource.get('capacity', 40) * (allocation_percentage / 100)
        
        if required_hours > availability_metrics['available_hours']:
            raise HTTPException(
                status_code=400, 
                detail=f"Resource does not have sufficient capacity. Available: {availability_metrics['available_hours']:.1f}h, Required: {required_hours:.1f}h"
            )
        
        # Create or update project_resources allocation
        allocation_data = {
            "project_id": str(project_id),
            "resource_id": str(resource_id),
            "allocation_percentage": allocation_percentage,
            "role_in_project": role_in_project,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "hourly_rate": resource.get('hourly_rate')
        }
        
        # Check if allocation already exists
        existing_response = supabase.table("project_resources").select("*").eq("project_id", str(project_id)).eq("resource_id", str(resource_id)).execute()
        
        if existing_response.data:
            # Update existing allocation
            response = supabase.table("project_resources").update(allocation_data).eq("project_id", str(project_id)).eq("resource_id", str(resource_id)).execute()
        else:
            # Create new allocation
            response = supabase.table("project_resources").insert(allocation_data).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create resource allocation")
        
        return {
            "message": "Resource allocated successfully",
            "allocation": convert_uuids(response.data[0]),
            "resource_availability": calculate_enhanced_resource_availability(resource)
        }
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Allocation failed: {str(e)}")

@app.delete("/resources/{resource_id}/allocate/{project_id}")
async def deallocate_resource_from_project(
    resource_id: UUID,
    project_id: UUID,
    current_user = Depends(get_current_user)
):
    """Remove resource allocation from a project"""
    try:
        response = supabase.table("project_resources").delete().eq("project_id", str(project_id)).eq("resource_id", str(resource_id)).execute()
        
        if response.count == 0:
            raise HTTPException(status_code=404, detail="Resource allocation not found")
        
        return {"message": "Resource deallocated successfully"}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Deallocation failed: {str(e)}")

@app.get("/resources/skills/summary")
async def get_skills_summary(current_user = Depends(get_current_user)):
    """Get summary of all skills across resources"""
    response = supabase.table("resources").select("skills").execute()
    
    skill_counts = {}
    total_resources = 0
    
    for resource in response.data:
        if resource.get('skills'):
            total_resources += 1
            for skill in resource['skills']:
                skill_lower = skill.lower().strip()
                if skill_lower in skill_counts:
                    skill_counts[skill_lower]['count'] += 1
                    skill_counts[skill_lower]['resources'].append(resource)
                else:
                    skill_counts[skill_lower] = {
                        'skill': skill,  # Keep original casing
                        'count': 1,
                        'resources': [resource]
                    }
    
    # Convert to list and sort by count
    skills_summary = []
    for skill_data in skill_counts.values():
        skills_summary.append({
            'skill': skill_data['skill'],
            'count': skill_data['count'],
            'percentage': (skill_data['count'] / total_resources * 100) if total_resources > 0 else 0
        })
    
    skills_summary.sort(key=lambda x: x['count'], reverse=True)
    
    return {
        'total_resources': total_resources,
        'total_unique_skills': len(skills_summary),
        'skills': skills_summary
    }

# RAG-based Reporting Endpoints
@app.post("/reports/query", response_model=RAGResponse)
async def query_rag_system(request: RAGQueryRequest, current_user = Depends(get_current_user)):
    """Process natural language queries and generate reports using RAG"""
    try:
        # Gather relevant context based on query
        context_data = await gather_context_for_query(request.query, request.context_type)
        
        # Generate response using OpenAI
        response = await generate_rag_response(request.query, context_data)
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

@app.post("/reports/generate")
async def generate_custom_report(request: ReportGenerationRequest, current_user = Depends(get_current_user)):
    """Generate comprehensive reports based on natural language requests"""
    try:
        # Analyze query to determine what data is needed
        query_analysis = analyze_report_query(request.query)
        
        # Gather comprehensive data
        report_data = await gather_report_data(query_analysis)
        
        # Generate report using AI
        report = await generate_ai_report(request.query, report_data, request.format)
        
        return {
            "report": report,
            "query": request.query,
            "data_sources": list(report_data.keys()),
            "generated_at": "2024-01-01T00:00:00Z"  # Would use actual timestamp
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

async def gather_context_for_query(query: str, context_type: str | None = None) -> Dict[str, Any]:
    """Gather relevant context data for RAG processing"""
    context = {}
    
    # Always include basic project and resource data
    projects_response = supabase.table("projects").select("*").execute()
    resources_response = supabase.table("resources").select("*").execute()
    
    context["projects"] = convert_uuids(projects_response.data)
    context["resources"] = convert_uuids(resources_response.data)
    
    # Add specific context based on query analysis
    query_lower = query.lower()
    
    if "budget" in query_lower or "cost" in query_lower or "financial" in query_lower:
        # Add financial context (simulated for now)
        context["financial"] = {
            "total_budget": sum(p.get("budget", 0) for p in context["projects"] if p.get("budget")),
            "total_actual_cost": sum(p.get("actual_cost", 0) for p in context["projects"] if p.get("actual_cost")),
            "budget_utilization": "75%"  # Simulated
        }
    
    if "risk" in query_lower or "issue" in query_lower:
        # Add risk context (simulated for now)
        context["risks"] = [
            {"type": "schedule", "probability": 0.3, "impact": 0.7, "project_id": "sample"},
            {"type": "resource", "probability": 0.5, "impact": 0.6, "project_id": "sample"}
        ]
    
    if "utilization" in query_lower or "capacity" in query_lower:
        # Add resource utilization context
        utilization_response = await get_resource_utilization(None)
        context["utilization"] = utilization_response
    
    return context

async def generate_rag_response(query: str, context_data: Dict[str, Any]) -> RAGResponse:
    """Generate AI response using OpenAI with context data"""
    
    # Prepare context for AI
    context_text = f"""
    Available Data:
    - Projects: {len(context_data.get('projects', []))} projects
    - Resources: {len(context_data.get('resources', []))} resources
    
    Project Details:
    {json.dumps(context_data.get('projects', [])[:5], indent=2)}
    
    Resource Details:
    {json.dumps(context_data.get('resources', [])[:5], indent=2)}
    
    Financial Data:
    {json.dumps(context_data.get('financial', {}), indent=2)}
    
    Risk Data:
    {json.dumps(context_data.get('risks', []), indent=2)}
    """
    
    try:
        # Use OpenAI to generate response
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": """You are an AI assistant for a Project Portfolio Management system. 
                    Analyze the provided data and answer questions about projects, resources, budgets, risks, and utilization.
                    Provide specific, data-driven answers based on the context provided.
                    If you cannot find specific information, clearly state that."""
                },
                {
                    "role": "user",
                    "content": f"Context: {context_text}\n\nQuestion: {query}"
                }
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        answer = response.choices[0].message.content
        
        # Determine query type
        query_type = "general"
        if "project" in query.lower():
            query_type = "projects"
        elif "resource" in query.lower():
            query_type = "resources"
        elif "budget" in query.lower() or "cost" in query.lower():
            query_type = "financial"
        elif "risk" in query.lower():
            query_type = "risks"
        
        # Create sources list
        sources = []
        for key, data in context_data.items():
            if isinstance(data, list):
                sources.append({"type": key, "count": len(data)})
            else:
                sources.append({"type": key, "data": str(data)[:100]})
        
        return RAGResponse(
            answer=answer,
            sources=sources,
            confidence=0.85,  # Simulated confidence score
            query_type=query_type,
            generated_at="2024-01-01T00:00:00Z"
        )
        
    except Exception as e:
        # Fallback response if OpenAI fails
        return RAGResponse(
            answer=f"I apologize, but I'm unable to process your query at the moment. Error: {str(e)}",
            sources=[],
            confidence=0.0,
            query_type="error",
            generated_at="2024-01-01T00:00:00Z"
        )

def analyze_report_query(query: str) -> Dict[str, bool]:
    """Analyze what type of data the report query needs"""
    query_lower = query.lower()
    
    return {
        "needs_projects": "project" in query_lower,
        "needs_resources": "resource" in query_lower or "team" in query_lower,
        "needs_financial": "budget" in query_lower or "cost" in query_lower or "financial" in query_lower,
        "needs_risks": "risk" in query_lower or "issue" in query_lower,
        "needs_utilization": "utilization" in query_lower or "capacity" in query_lower,
        "needs_timeline": "timeline" in query_lower or "schedule" in query_lower
    }

async def gather_report_data(analysis: Dict[str, bool]) -> Dict[str, Any]:
    """Gather comprehensive data for report generation"""
    data = {}
    
    if analysis["needs_projects"]:
        projects_response = supabase.table("projects").select("*").execute()
        data["projects"] = convert_uuids(projects_response.data)
    
    if analysis["needs_resources"]:
        resources_response = supabase.table("resources").select("*").execute()
        data["resources"] = convert_uuids(resources_response.data)
    
    if analysis["needs_utilization"]:
        # This would call the actual utilization endpoint
        data["utilization"] = []  # Placeholder
    
    if analysis["needs_financial"]:
        # Gather financial data
        data["financial"] = {
            "summary": "Financial data would be gathered here"
        }
    
    if analysis["needs_risks"]:
        # Gather risk data
        data["risks"] = []  # Placeholder
    
    return data

async def generate_ai_report(query: str, data: Dict[str, Any], format: str) -> str:
    """Generate comprehensive AI report"""
    
    data_summary = f"""
    Available Data for Report:
    {json.dumps(data, indent=2, default=str)[:2000]}
    """
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a business analyst creating comprehensive reports for a PPM system.
                    Generate a detailed report in {format} format based on the user's request and available data.
                    Include relevant metrics, insights, and recommendations."""
                },
                {
                    "role": "user",
                    "content": f"Data: {data_summary}\n\nGenerate a report for: {query}"
                }
            ],
            max_tokens=2000,
            temperature=0.3
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        return f"Report generation failed: {str(e)}"



# Risk Management Endpoints
@app.post("/risks/", response_model=RiskResponse, status_code=status.HTTP_201_CREATED)
async def create_risk(risk: RiskCreate, current_user = Depends(get_current_user)):
    try:
        risk_data = risk.dict()
        risk_data['status'] = RiskStatus.identified.value
        
        response = supabase.table("risks").insert(risk_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Risikos")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/risks/")
async def list_risks(
    project_id: UUID | None = Query(None),
    category: RiskCategory | None = Query(None),
    status: RiskStatus | None = Query(None),
    current_user = Depends(get_current_user)
):
    query = supabase.table("risks").select("*")
    
    if project_id:
        query = query.eq("project_id", str(project_id))
    if category:
        query = query.eq("category", category.value)
    if status:
        query = query.eq("status", status.value)
    
    response = query.order("risk_score", desc=True).execute()
    return convert_uuids(response.data)

@app.get("/risks/{risk_id}", response_model=RiskResponse)
async def get_risk(risk_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("risks").select("*").eq("id", str(risk_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Risk not found")
    return convert_uuids(response.data[0])

@app.patch("/risks/{risk_id}", response_model=RiskResponse)
async def update_risk(risk_id: UUID, risk_update: RiskUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in risk_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    response = supabase.table("risks").update(data_to_update).eq("id", str(risk_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    return convert_uuids(response.data[0])

@app.delete("/risks/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_risk(risk_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("risks").delete().eq("id", str(risk_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Risk not found")
    return None

@app.post("/risks/{risk_id}/materialize", response_model=IssueResponse)
async def materialize_risk_to_issue(
    risk_id: UUID, 
    issue_data: dict = {},
    current_user = Depends(get_current_user)
):
    """Convert a risk into an issue when it materializes"""
    # Get the risk
    risk_response = supabase.table("risks").select("*").eq("id", str(risk_id)).execute()
    if not risk_response.data:
        raise HTTPException(status_code=404, detail="Risk not found")
    
    risk = risk_response.data[0]
    
    # Create issue from risk
    issue_create_data = {
        "project_id": risk["project_id"],
        "risk_id": str(risk_id),
        "title": issue_data.get("title", f"Issue from Risk: {risk['title']}"),
        "description": issue_data.get("description", f"Materialized from risk: {risk['description']}"),
        "severity": issue_data.get("severity", "high" if risk["risk_score"] > 0.7 else "medium"),
        "assigned_to": issue_data.get("assigned_to", risk.get("owner_id")),
        "reporter_id": current_user["user_id"],
        "status": "open"
    }
    
    response = supabase.table("issues").insert(issue_create_data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Issues")
    
    # Update risk status to closed
    supabase.table("risks").update({"status": "closed"}).eq("id", str(risk_id)).execute()
    
    return convert_uuids(response.data[0])

# Issue Management Endpoints
@app.post("/issues/", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(issue: IssueCreate, current_user = Depends(get_current_user)):
    try:
        issue_data = issue.dict()
        issue_data['status'] = IssueStatus.open.value
        issue_data['reporter_id'] = current_user["user_id"]
        
        response = supabase.table("issues").insert(issue_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Issues")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/issues/")
async def list_issues(
    project_id: UUID | None = Query(None),
    severity: IssueSeverity | None = Query(None),
    status: IssueStatus | None = Query(None),
    assigned_to: UUID | None = Query(None),
    current_user = Depends(get_current_user)
):
    query = supabase.table("issues").select("*")
    
    if project_id:
        query = query.eq("project_id", str(project_id))
    if severity:
        query = query.eq("severity", severity.value)
    if status:
        query = query.eq("status", status.value)
    if assigned_to:
        query = query.eq("assigned_to", str(assigned_to))
    
    response = query.order("created_at", desc=True).execute()
    return convert_uuids(response.data)

@app.get("/issues/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("issues").select("*").eq("id", str(issue_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    return convert_uuids(response.data[0])

@app.patch("/issues/{issue_id}", response_model=IssueResponse)
async def update_issue(issue_id: UUID, issue_update: IssueUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in issue_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    # If status is being set to resolved/closed, set resolution_date
    if data_to_update.get('status') in ['resolved', 'closed']:
        data_to_update['resolution_date'] = datetime.now().isoformat()
    
    response = supabase.table("issues").update(data_to_update).eq("id", str(issue_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    return convert_uuids(response.data[0])

@app.delete("/issues/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_issue(issue_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("issues").delete().eq("id", str(issue_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Issue not found")
    return None

@app.get("/projects/{project_id}/risks-issues-summary")
async def get_project_risks_issues_summary(project_id: UUID, current_user = Depends(get_current_user)):
    """Get summary of risks and issues for a project"""
    # Get risks
    risks_response = supabase.table("risks").select("*").eq("project_id", str(project_id)).execute()
    risks = convert_uuids(risks_response.data)
    
    # Get issues
    issues_response = supabase.table("issues").select("*").eq("project_id", str(project_id)).execute()
    issues = convert_uuids(issues_response.data)
    
    # Calculate risk statistics
    risk_stats = {
        "total": len(risks),
        "by_status": {},
        "by_category": {},
        "high_risk_count": 0,
        "average_risk_score": 0
    }
    
    if risks:
        for risk in risks:
            # Count by status
            status = risk.get('status', 'identified')
            risk_stats["by_status"][status] = risk_stats["by_status"].get(status, 0) + 1
            
            # Count by category
            category = risk.get('category', 'unknown')
            risk_stats["by_category"][category] = risk_stats["by_category"].get(category, 0) + 1
            
            # Count high risks (score > 0.7)
            if risk.get('risk_score', 0) > 0.7:
                risk_stats["high_risk_count"] += 1
        
        # Calculate average risk score
        risk_stats["average_risk_score"] = sum(r.get('risk_score', 0) for r in risks) / len(risks)
    
    # Calculate issue statistics
    issue_stats = {
        "total": len(issues),
        "by_status": {},
        "by_severity": {},
        "overdue_count": 0
    }
    
    if issues:
        today = date.today()
        for issue in issues:
            # Count by status
            status = issue.get('status', 'open')
            issue_stats["by_status"][status] = issue_stats["by_status"].get(status, 0) + 1
            
            # Count by severity
            severity = issue.get('severity', 'medium')
            issue_stats["by_severity"][severity] = issue_stats["by_severity"].get(severity, 0) + 1
            
            # Count overdue issues
            due_date = issue.get('due_date')
            if due_date and issue.get('status') not in ['resolved', 'closed']:
                due_date_obj = due_date if isinstance(due_date, date) else date.fromisoformat(str(due_date))
                if due_date_obj < today:
                    issue_stats["overdue_count"] += 1
    
    return {
        "project_id": str(project_id),
        "risks": risk_stats,
        "issues": issue_stats,
        "risk_issue_links": len([i for i in issues if i.get('risk_id')])
    }

# Financial Tracking Endpoints
@app.post("/financial-tracking/", response_model=FinancialTrackingResponse, status_code=status.HTTP_201_CREATED)
async def create_financial_tracking(financial: FinancialTrackingCreate, current_user = Depends(get_current_user)):
    try:
        financial_data = financial.dict()
        financial_data['recorded_by'] = current_user["user_id"]
        
        # Update exchange rate if not USD
        if financial_data['currency'] != 'USD':
            financial_data['exchange_rate'] = get_exchange_rate(financial_data['currency'], 'USD')
        
        response = supabase.table("financial_tracking").insert(financial_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Financial Tracking")
        
        # Update project actual_cost
        project_id = financial_data['project_id']
        variance = await calculate_project_budget_variance(str(project_id))
        supabase.table("projects").update({"actual_cost": variance['total_actual']}).eq("id", str(project_id)).execute()
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/financial-tracking/")
async def list_financial_tracking(
    project_id: UUID | None = Query(None),
    category: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user = Depends(get_current_user)
):
    query = supabase.table("financial_tracking").select("*")
    
    if project_id:
        query = query.eq("project_id", str(project_id))
    if category:
        query = query.eq("category", category)
    if start_date:
        query = query.gte("date_incurred", start_date.isoformat())
    if end_date:
        query = query.lte("date_incurred", end_date.isoformat())
    
    response = query.order("date_incurred", desc=True).execute()
    return convert_uuids(response.data)

@app.get("/financial-tracking/{tracking_id}", response_model=FinancialTrackingResponse)
async def get_financial_tracking(tracking_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("financial_tracking").select("*").eq("id", str(tracking_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Financial tracking record not found")
    return convert_uuids(response.data[0])

@app.patch("/financial-tracking/{tracking_id}", response_model=FinancialTrackingResponse)
async def update_financial_tracking(tracking_id: UUID, financial_update: FinancialTrackingUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in financial_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    # Update exchange rate if currency changed
    if 'currency' in data_to_update and data_to_update['currency'] != 'USD':
        data_to_update['exchange_rate'] = get_exchange_rate(data_to_update['currency'], 'USD')
    
    response = supabase.table("financial_tracking").update(data_to_update).eq("id", str(tracking_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Financial tracking record not found")
    
    # Update project actual_cost
    record = response.data[0]
    project_id = record['project_id']
    variance = await calculate_project_budget_variance(project_id)
    supabase.table("projects").update({"actual_cost": variance['total_actual']}).eq("id", project_id).execute()
    
    return convert_uuids(response.data[0])

@app.delete("/financial-tracking/{tracking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_financial_tracking(tracking_id: UUID, current_user = Depends(get_current_user)):
    # Get the record first to update project costs after deletion
    record_response = supabase.table("financial_tracking").select("project_id").eq("id", str(tracking_id)).execute()
    
    response = supabase.table("financial_tracking").delete().eq("id", str(tracking_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Financial tracking record not found")
    
    # Update project actual_cost
    if record_response.data:
        project_id = record_response.data[0]['project_id']
        variance = await calculate_project_budget_variance(project_id)
        supabase.table("projects").update({"actual_cost": variance['total_actual']}).eq("id", project_id).execute()
    
    return None

@app.get("/projects/{project_id}/budget-variance", response_model=BudgetVarianceResponse)
async def get_project_budget_variance(project_id: UUID, currency: CurrencyCode = CurrencyCode.USD, current_user = Depends(get_current_user)):
    """Get budget variance analysis for a project"""
    return await calculate_project_budget_variance(str(project_id), currency.value)

@app.get("/financial-tracking/exchange-rates")
async def get_exchange_rates(base_currency: CurrencyCode = CurrencyCode.USD, current_user = Depends(get_current_user)):
    """Get current exchange rates"""
    rates = {}
    for currency in CurrencyCode:
        rates[currency.value] = get_exchange_rate(base_currency.value, currency.value)
    
    return {
        "base_currency": base_currency.value,
        "rates": rates,
        "last_updated": datetime.now().isoformat()
    }

@app.post("/financial-tracking/reports")
async def generate_financial_report(report_request: FinancialReportRequest, current_user = Depends(get_current_user)):
    """Generate comprehensive financial report"""
    query = supabase.table("financial_tracking").select("*")
    
    # Apply filters
    if report_request.project_ids:
        project_ids = [str(pid) for pid in report_request.project_ids]
        query = query.in_("project_id", project_ids)
    
    if report_request.start_date:
        query = query.gte("date_incurred", report_request.start_date.isoformat())
    
    if report_request.end_date:
        query = query.lte("date_incurred", report_request.end_date.isoformat())
    
    if report_request.categories:
        query = query.in_("category", report_request.categories)
    
    response = query.execute()
    financial_records = response.data
    
    # Calculate summary statistics
    total_planned = 0
    total_actual = 0
    by_category = {}
    by_project = {}
    by_month = {}
    
    for record in financial_records:
        # Convert to target currency
        planned = convert_currency(record['planned_amount'], record['currency'], report_request.currency.value)
        actual = convert_currency(record['actual_amount'], record['currency'], report_request.currency.value)
        
        total_planned += planned
        total_actual += actual
        
        # Group by category
        category = record['category']
        if category not in by_category:
            by_category[category] = {'planned': 0, 'actual': 0, 'count': 0}
        by_category[category]['planned'] += planned
        by_category[category]['actual'] += actual
        by_category[category]['count'] += 1
        
        # Group by project
        project_id = record['project_id']
        if project_id not in by_project:
            by_project[project_id] = {'planned': 0, 'actual': 0, 'count': 0}
        by_project[project_id]['planned'] += planned
        by_project[project_id]['actual'] += actual
        by_project[project_id]['count'] += 1
        
        # Group by month
        date_incurred = record['date_incurred']
        if isinstance(date_incurred, str):
            date_obj = date.fromisoformat(date_incurred)
        else:
            date_obj = date_incurred
        
        month_key = f"{date_obj.year}-{date_obj.month:02d}"
        if month_key not in by_month:
            by_month[month_key] = {'planned': 0, 'actual': 0, 'count': 0}
        by_month[month_key]['planned'] += planned
        by_month[month_key]['actual'] += actual
        by_month[month_key]['count'] += 1
    
    # Calculate variance
    variance_amount = total_actual - total_planned
    variance_percentage = (variance_amount / total_planned * 100) if total_planned > 0 else 0
    
    return {
        "report_period": {
            "start_date": report_request.start_date.isoformat() if report_request.start_date else None,
            "end_date": report_request.end_date.isoformat() if report_request.end_date else None
        },
        "currency": report_request.currency.value,
        "summary": {
            "total_planned": total_planned,
            "total_actual": total_actual,
            "variance_amount": variance_amount,
            "variance_percentage": variance_percentage,
            "record_count": len(financial_records)
        },
        "by_category": by_category,
        "by_project": by_project,
        "by_month": dict(sorted(by_month.items())),
        "generated_at": datetime.now().isoformat()
    }

@app.get("/financial-tracking/budget-alerts")
async def get_budget_alerts(threshold_percentage: float = 80.0, current_user = Depends(get_current_user)):
    """Get budget alerts for projects exceeding threshold"""
    # Get all projects with budgets
    projects_response = supabase.table("projects").select("id, name, budget").execute()
    projects = projects_response.data
    
    alerts = []
    
    for project in projects:
        if project.get('budget') and project['budget'] > 0:
            try:
                variance = await calculate_project_budget_variance(project['id'])
                
                utilization_percentage = (variance['total_actual'] / variance['total_planned'] * 100) if variance['total_planned'] > 0 else 0
                
                if utilization_percentage >= threshold_percentage:
                    alert_level = "critical" if utilization_percentage > 100 else "warning"
                    
                    alerts.append({
                        "project_id": project['id'],
                        "project_name": project['name'],
                        "budget": variance['total_planned'],
                        "actual_cost": variance['total_actual'],
                        "utilization_percentage": utilization_percentage,
                        "variance_amount": variance['variance_amount'],
                        "alert_level": alert_level,
                        "message": f"Project is at {utilization_percentage:.1f}% of budget"
                    })
            except Exception:
                continue  # Skip projects with calculation errors
    
    # Sort by utilization percentage descending
    alerts.sort(key=lambda x: x['utilization_percentage'], reverse=True)
    
    return {
        "threshold_percentage": threshold_percentage,
        "alert_count": len(alerts),
        "alerts": alerts,
        "generated_at": datetime.now().isoformat()
    }

# Portfolio-level metrics and analytics endpoints
@app.get("/portfolio/metrics")
async def get_portfolio_metrics(portfolio_id: UUID | None = Query(None), current_user = Depends(get_current_user)):
    """Get comprehensive portfolio-level metrics and KPIs"""
    start_time = datetime.now()
    
    # Get projects (filtered by portfolio if specified)
    query = supabase.table("projects").select("*")
    if portfolio_id:
        query = query.eq("portfolio_id", str(portfolio_id))
    projects_response = query.execute()
    projects = projects_response.data
    
    if not projects:
        return {
            "total_projects": 0,
            "health_distribution": {"green": 0, "yellow": 0, "red": 0},
            "status_distribution": {},
            "budget_metrics": {"total_budget": 0, "total_actual": 0, "variance": 0},
            "timeline_metrics": {"on_time": 0, "at_risk": 0, "overdue": 0},
            "resource_utilization": {"total_resources": 0, "average_utilization": 0},
            "calculation_time_ms": 0
        }
    
    # Calculate health distribution
    health_distribution = {"green": 0, "yellow": 0, "red": 0}
    for project in projects:
        health = project.get('health', 'green')
        health_distribution[health] = health_distribution.get(health, 0) + 1
    
    # Calculate status distribution
    status_distribution = {}
    for project in projects:
        status = project.get('status', 'planning')
        status_distribution[status] = status_distribution.get(status, 0) + 1
    
    # Calculate budget metrics
    total_budget = sum(float(p.get('budget', 0)) for p in projects if p.get('budget'))
    total_actual = sum(float(p.get('actual_cost', 0)) for p in projects if p.get('actual_cost'))
    budget_variance = total_actual - total_budget
    
    # Calculate timeline metrics
    timeline_metrics = {"on_time": 0, "at_risk": 0, "overdue": 0}
    today = date.today()
    
    for project in projects:
        if project.get('end_date'):
            end_date = project['end_date']
            if isinstance(end_date, str):
                end_date = date.fromisoformat(end_date)
            
            if project.get('status') == 'completed':
                timeline_metrics["on_time"] += 1
            elif end_date < today:
                timeline_metrics["overdue"] += 1
            elif (end_date - today).days <= 30:  # At risk if due within 30 days
                timeline_metrics["at_risk"] += 1
            else:
                timeline_metrics["on_time"] += 1
    
    # Calculate resource utilization (simplified)
    resources_response = supabase.table("resources").select("*").execute()
    resources = resources_response.data
    total_resources = len(resources)
    average_utilization = sum(r.get('availability', 100) for r in resources) / total_resources if total_resources > 0 else 0
    
    # Calculate performance metrics
    calculation_time = (datetime.now() - start_time).total_seconds() * 1000
    
    return {
        "total_projects": len(projects),
        "health_distribution": health_distribution,
        "status_distribution": status_distribution,
        "budget_metrics": {
            "total_budget": total_budget,
            "total_actual": total_actual,
            "variance": budget_variance,
            "variance_percentage": (budget_variance / total_budget * 100) if total_budget > 0 else 0
        },
        "timeline_metrics": timeline_metrics,
        "resource_utilization": {
            "total_resources": total_resources,
            "average_utilization": average_utilization
        },
        "calculation_time_ms": round(calculation_time, 2),
        "generated_at": datetime.now().isoformat()
    }

@app.get("/portfolio/trends")
async def get_portfolio_trends(
    portfolio_id: UUID | None = Query(None),
    days: int = Query(30, description="Number of days for trend analysis"),
    current_user = Depends(get_current_user)
):
    """Get portfolio trend analysis over time"""
    
    # Get projects
    query = supabase.table("projects").select("*")
    if portfolio_id:
        query = query.eq("portfolio_id", str(portfolio_id))
    projects_response = query.execute()
    projects = projects_response.data
    
    # Get financial tracking data for trend analysis
    financial_query = supabase.table("financial_tracking").select("*")
    if portfolio_id:
        # Filter by projects in the portfolio
        project_ids = [p['id'] for p in projects]
        if project_ids:
            financial_query = financial_query.in_("project_id", project_ids)
    
    financial_response = financial_query.execute()
    financial_data = financial_response.data
    
    # Calculate daily budget utilization trends
    from collections import defaultdict
    daily_spending = defaultdict(float)
    
    for record in financial_data:
        date_key = record.get('date_incurred', record.get('created_at', ''))[:10]  # YYYY-MM-DD
        daily_spending[date_key] += float(record.get('actual_amount', 0))
    
    # Generate trend data for the last N days
    trend_data = []
    current_date = date.today()
    
    for i in range(days):
        check_date = current_date - timedelta(days=i)
        date_str = check_date.isoformat()
        
        trend_data.append({
            "date": date_str,
            "spending": daily_spending.get(date_str, 0),
            "projects_count": len([p for p in projects if p.get('created_at', '')[:10] <= date_str])
        })
    
    trend_data.reverse()  # Chronological order
    
    return {
        "period_days": days,
        "trend_data": trend_data,
        "summary": {
            "total_spending": sum(d["spending"] for d in trend_data),
            "average_daily_spending": sum(d["spending"] for d in trend_data) / len(trend_data) if trend_data else 0,
            "peak_spending_day": max(trend_data, key=lambda x: x["spending"]) if trend_data else None
        },
        "generated_at": datetime.now().isoformat()
    }

@app.get("/portfolio/kpis")
async def get_portfolio_kpis(portfolio_id: UUID | None = Query(None), current_user = Depends(get_current_user)):
    """Get key performance indicators for the portfolio"""
    
    # Get projects
    query = supabase.table("projects").select("*")
    if portfolio_id:
        query = query.eq("portfolio_id", str(portfolio_id))
    projects_response = query.execute()
    projects = projects_response.data
    
    if not projects:
        return {"message": "No projects found", "kpis": {}}
    
    # Calculate KPIs
    total_projects = len(projects)
    completed_projects = len([p for p in projects if p.get('status') == 'completed'])
    active_projects = len([p for p in projects if p.get('status') == 'active'])
    
    # Success rate
    success_rate = (completed_projects / total_projects * 100) if total_projects > 0 else 0
    
    # Budget performance
    projects_with_budget = [p for p in projects if p.get('budget') and p.get('actual_cost') is not None]
    on_budget_projects = len([p for p in projects_with_budget if float(p.get('actual_cost', 0)) <= float(p.get('budget', 0))])
    budget_performance = (on_budget_projects / len(projects_with_budget) * 100) if projects_with_budget else 0
    
    # Health score
    health_scores = {"green": 3, "yellow": 2, "red": 1}
    total_health_score = sum(health_scores.get(p.get('health', 'green'), 3) for p in projects)
    average_health_score = total_health_score / total_projects if total_projects > 0 else 3
    
    # Timeline performance
    today = date.today()
    on_time_projects = 0
    projects_with_dates = 0
    
    for project in projects:
        if project.get('end_date'):
            projects_with_dates += 1
            end_date = project['end_date']
            if isinstance(end_date, str):
                end_date = date.fromisoformat(end_date)
            
            if project.get('status') == 'completed' or end_date >= today:
                on_time_projects += 1
    
    timeline_performance = (on_time_projects / projects_with_dates * 100) if projects_with_dates > 0 else 0
    
    # Resource efficiency (simplified)
    resources_response = supabase.table("resources").select("*").execute()
    resources = resources_response.data
    total_capacity = sum(r.get('capacity', 40) for r in resources)
    allocated_capacity = sum(r.get('capacity', 40) * (100 - r.get('availability', 0)) / 100 for r in resources)
    resource_efficiency = (allocated_capacity / total_capacity * 100) if total_capacity > 0 else 0
    
    return {
        "kpis": {
            "project_success_rate": round(success_rate, 1),
            "budget_performance": round(budget_performance, 1),
            "timeline_performance": round(timeline_performance, 1),
            "average_health_score": round(average_health_score, 2),
            "resource_efficiency": round(resource_efficiency, 1),
            "active_projects_ratio": round((active_projects / total_projects * 100), 1) if total_projects > 0 else 0
        },
        "details": {
            "total_projects": total_projects,
            "completed_projects": completed_projects,
            "active_projects": active_projects,
            "projects_with_budget": len(projects_with_budget),
            "on_budget_projects": on_budget_projects,
            "projects_with_dates": projects_with_dates,
            "on_time_projects": on_time_projects,
            "total_resources": len(resources)
        },
        "generated_at": datetime.now().isoformat()
    }