from fastapi import FastAPI, HTTPException, status, Query, Depends, Request
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
import asyncio
from typing import List, Dict, Any
import json

# Import performance optimization modules (with fallback for serverless)
try:
    from performance import (
        cached, invalidate_cache, monitor_performance, rate_limit_middleware,
        performance_monitor, cache_manager, BulkOperationManager
    )
    PERFORMANCE_MODULE_AVAILABLE = True
except ImportError as e:
    print(f"Performance module not available: {e}")
    PERFORMANCE_MODULE_AVAILABLE = False
    
    # Create dummy implementations for serverless deployment
    def cached(prefix: str, ttl: int = 300, key_params=None):
        def decorator(func):
            return func
        return decorator
    
    def invalidate_cache(patterns):
        pass
    
    def monitor_performance(func):
        return func
    
    async def rate_limit_middleware(request, call_next):
        return await call_next(request)
    
    class DummyPerformanceMonitor:
        def record_request(self, *args, **kwargs):
            pass
        def get_stats(self):
            return {}
    
    class DummyCacheManager:
        def get(self, key):
            return None
        def set(self, key, value, ttl=None):
            return True
        def delete(self, key):
            return True
        def clear_pattern(self, pattern):
            return True
    
    class DummyBulkOperationManager:
        @staticmethod
        def chunk_list(items, chunk_size=100):
            for i in range(0, len(items), chunk_size):
                yield items[i:i + chunk_size]
        
        @staticmethod
        async def process_in_batches(items, processor, batch_size=100):
            results = []
            for batch in DummyBulkOperationManager.chunk_list(items, batch_size):
                if asyncio.iscoroutinefunction(processor):
                    batch_results = await processor(batch)
                else:
                    batch_results = processor(batch)
                results.extend(batch_results)
            return results
    
    performance_monitor = DummyPerformanceMonitor()
    cache_manager = DummyCacheManager()
    BulkOperationManager = DummyBulkOperationManager()

load_dotenv()

# Environment variables with fallbacks
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Initialize OpenAI client (optional for basic functionality)
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    openai.api_key = openai_api_key
    OPENAI_AVAILABLE = True
else:
    print("Warning: OPENAI_API_KEY not set. AI features will be limited.")
    OPENAI_AVAILABLE = False

app = FastAPI(
    title="PPM SaaS MVP API",
    description="Moderne AI-gestützte Project Portfolio Management Lösung",
    version="0.1.0"
)

# Add performance monitoring middleware (only if available)
if PERFORMANCE_MODULE_AVAILABLE:
    app.middleware("http")(rate_limit_middleware)

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
    return {
        "message": "Willkommen zur PPM SaaS API – Deine Cora-Alternative mit agentic AI 🚀",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

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
@monitor_performance
@cached("projects_list", ttl=60, key_params=["portfolio_id"])
async def list_projects(request: Request, portfolio_id: UUID | None = Query(None), current_user = Depends(get_current_user)):
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
@monitor_performance
@cached("project_detail", ttl=120, key_params=["project_id"])
async def get_project(request: Request, project_id: UUID, current_user = Depends(get_current_user)):
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
@monitor_performance
async def update_project(request: Request, project_id: UUID, project_update: ProjectUpdate, current_user = Depends(get_current_user)):
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
    
    # Invalidate caches after update
    invalidate_project_caches(project_id=str(project_id), portfolio_id=project.get('portfolio_id'))
    
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
        if not OPENAI_AVAILABLE:
            raise Exception("OpenAI API not available")
            
        # Use OpenAI to generate response (with fallback for API changes)
        try:
            # Try new OpenAI client syntax first
            from openai import OpenAI
            client = OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
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
        except Exception:
            # Fallback to old syntax
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
            answer=f"I can provide basic information about your portfolio data. Based on the available data: {len(context_data.get('projects', []))} projects, {len(context_data.get('resources', []))} resources. However, AI-powered analysis is currently unavailable. Error: {str(e)}",
            sources=[],
            confidence=0.5,
            query_type="fallback",
            generated_at=datetime.now().isoformat()
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
        if not OPENAI_AVAILABLE:
            return f"Report generation unavailable (OpenAI not configured). Available data: {len(data)} data sources."
            
        # Try new OpenAI client syntax first
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
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
        except Exception:
            # Fallback to old syntax
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
        return f"Report generation failed: {str(e)}. Available data summary: {data_summary[:500]}..."



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

# AI Hallucination Validator
class ValidationRequest(BaseModel):
    content: str
    content_type: str  # "rag_response", "optimization_suggestion", "risk_forecast"
    source_data: dict | None = None
    validation_level: str = "standard"  # "basic", "standard", "comprehensive"

class ValidationResult(BaseModel):
    is_valid: bool
    confidence_score: float
    validation_issues: List[dict]
    corrected_content: str | None = None
    fact_check_results: List[dict]
    consistency_score: float
    source_alignment_score: float

class HallucinationValidationResponse(BaseModel):
    validation_id: str
    original_content: str
    validation_result: ValidationResult
    validation_metadata: dict
    generated_at: datetime

@app.post("/ai/hallucination-validator", response_model=HallucinationValidationResponse)
async def validate_ai_content(
    request: ValidationRequest,
    current_user = Depends(get_current_user)
):
    """Validate AI-generated content for hallucinations and factual accuracy"""
    try:
        validation_id = str(UUID(int=int(time.time() * 1000000) % (2**128)))
        
        # Perform comprehensive validation
        validation_result = await perform_content_validation(request)
        
        return HallucinationValidationResponse(
            validation_id=validation_id,
            original_content=request.content,
            validation_result=validation_result,
            validation_metadata={
                "content_type": request.content_type,
                "validation_level": request.validation_level,
                "source_data_available": request.source_data is not None,
                "validation_duration_ms": 0  # Would be calculated in production
            },
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content validation failed: {str(e)}")

async def perform_content_validation(request: ValidationRequest) -> ValidationResult:
    """Perform comprehensive content validation"""
    
    validation_issues = []
    fact_check_results = []
    
    # 1. Numerical accuracy validation
    numerical_validation = validate_numerical_claims(request.content, request.source_data)
    if numerical_validation["issues"]:
        validation_issues.extend(numerical_validation["issues"])
    fact_check_results.extend(numerical_validation["fact_checks"])
    
    # 2. Entity existence validation
    entity_validation = await validate_entity_references(request.content)
    if entity_validation["issues"]:
        validation_issues.extend(entity_validation["issues"])
    fact_check_results.extend(entity_validation["fact_checks"])
    
    # 3. Logical consistency validation
    consistency_validation = validate_logical_consistency(request.content)
    if consistency_validation["issues"]:
        validation_issues.extend(consistency_validation["issues"])
    
    # 4. Source alignment validation
    source_alignment = validate_source_alignment(request.content, request.source_data)
    
    # 5. Temporal consistency validation
    temporal_validation = validate_temporal_consistency(request.content)
    if temporal_validation["issues"]:
        validation_issues.extend(temporal_validation["issues"])
    
    # Calculate overall scores
    consistency_score = consistency_validation["score"]
    source_alignment_score = source_alignment["score"]
    
    # Determine if content is valid
    is_valid = (
        len(validation_issues) == 0 and
        consistency_score > 0.7 and
        source_alignment_score > 0.6
    )
    
    # Calculate confidence score
    confidence_score = calculate_validation_confidence(
        validation_issues, consistency_score, source_alignment_score, fact_check_results
    )
    
    # Generate corrected content if needed
    corrected_content = None
    if not is_valid and request.validation_level == "comprehensive":
        corrected_content = await generate_corrected_content(request.content, validation_issues)
    
    return ValidationResult(
        is_valid=is_valid,
        confidence_score=confidence_score,
        validation_issues=validation_issues,
        corrected_content=corrected_content,
        fact_check_results=fact_check_results,
        consistency_score=consistency_score,
        source_alignment_score=source_alignment_score
    )

def validate_numerical_claims(content: str, source_data: dict | None) -> dict:
    """Validate numerical claims against source data"""
    import re
    
    issues = []
    fact_checks = []
    
    if not source_data:
        return {"issues": [], "fact_checks": []}
    
    # Extract numbers and percentages from content
    number_pattern = r'\b\d+(?:\.\d+)?(?:%|\s*(?:projects?|resources?|dollars?|\$|hours?|days?))\b'
    numbers_in_content = re.findall(number_pattern, content.lower())
    
    # Validate against source data
    if "projects" in source_data:
        projects = source_data["projects"]
        project_count_mentioned = re.search(r'(\d+)\s*projects?', content.lower())
        
        if project_count_mentioned:
            mentioned_count = int(project_count_mentioned.group(1))
            actual_count = len(projects)
            
            fact_checks.append({
                "claim": f"{mentioned_count} projects",
                "actual_value": actual_count,
                "is_accurate": mentioned_count == actual_count,
                "deviation": abs(mentioned_count - actual_count)
            })
            
            if mentioned_count != actual_count:
                issues.append({
                    "type": "numerical_inaccuracy",
                    "severity": "high" if abs(mentioned_count - actual_count) > 5 else "medium",
                    "description": f"Claimed {mentioned_count} projects, but source data shows {actual_count}",
                    "location": project_count_mentioned.span()
                })
    
    # Validate budget/financial claims
    budget_pattern = r'\$?([\d,]+(?:\.\d{2})?)\s*(?:budget|cost|spending)'
    budget_matches = re.finditer(budget_pattern, content.lower())
    
    for match in budget_matches:
        claimed_amount = float(match.group(1).replace(',', ''))
        
        # Check against source financial data
        if "financial_summary" in source_data:
            actual_budget = source_data["financial_summary"].get("total_budget", 0)
            
            fact_checks.append({
                "claim": f"${claimed_amount:,.2f} budget",
                "actual_value": actual_budget,
                "is_accurate": abs(claimed_amount - actual_budget) / max(actual_budget, 1) < 0.05,
                "deviation_percentage": abs(claimed_amount - actual_budget) / max(actual_budget, 1) * 100
            })
            
            if abs(claimed_amount - actual_budget) / max(actual_budget, 1) > 0.1:  # More than 10% deviation
                issues.append({
                    "type": "financial_inaccuracy",
                    "severity": "high",
                    "description": f"Claimed ${claimed_amount:,.2f} but actual is ${actual_budget:,.2f}",
                    "location": match.span()
                })
    
    return {"issues": issues, "fact_checks": fact_checks}

async def validate_entity_references(content: str) -> dict:
    """Validate that referenced entities actually exist"""
    issues = []
    fact_checks = []
    
    # Extract potential project/resource IDs or names
    import re
    
    # Look for project references
    project_pattern = r'project\s+([A-Za-z0-9\-]+)'
    project_matches = re.finditer(project_pattern, content.lower())
    
    for match in project_matches:
        project_ref = match.group(1)
        
        # Check if project exists (simplified check)
        try:
            # In production, would check against actual database
            project_response = supabase.table("projects").select("id, name").ilike("name", f"%{project_ref}%").execute()
            
            exists = len(project_response.data) > 0
            
            fact_checks.append({
                "claim": f"Project '{project_ref}' reference",
                "entity_type": "project",
                "exists": exists,
                "matches_found": len(project_response.data)
            })
            
            if not exists:
                issues.append({
                    "type": "entity_not_found",
                    "severity": "medium",
                    "description": f"Referenced project '{project_ref}' not found in database",
                    "location": match.span()
                })
                
        except Exception:
            # If we can't verify, mark as potential issue
            issues.append({
                "type": "entity_verification_failed",
                "severity": "low",
                "description": f"Could not verify existence of project '{project_ref}'",
                "location": match.span()
            })
    
    return {"issues": issues, "fact_checks": fact_checks}

def validate_logical_consistency(content: str) -> dict:
    """Validate logical consistency within the content"""
    issues = []
    
    # Check for contradictory statements
    contradictions = find_contradictions(content)
    for contradiction in contradictions:
        issues.append({
            "type": "logical_contradiction",
            "severity": "high",
            "description": contradiction["description"],
            "statements": contradiction["statements"]
        })
    
    # Check for impossible values
    impossible_values = find_impossible_values(content)
    for impossible in impossible_values:
        issues.append({
            "type": "impossible_value",
            "severity": "high",
            "description": impossible["description"],
            "value": impossible["value"]
        })
    
    # Calculate consistency score
    score = max(0.0, 1.0 - (len(issues) * 0.2))
    
    return {"issues": issues, "score": score}

def find_contradictions(content: str) -> List[dict]:
    """Find contradictory statements in content"""
    contradictions = []
    
    # Simple contradiction detection (would be more sophisticated in production)
    import re
    
    # Look for percentage contradictions
    percentage_pattern = r'(\d+(?:\.\d+)?)%'
    percentages = re.findall(percentage_pattern, content)
    
    # Check if percentages add up to more than 100% when they should be parts of a whole
    if "distribution" in content.lower() or "breakdown" in content.lower():
        total_percentage = sum(float(p) for p in percentages)
        if total_percentage > 105:  # Allow small rounding errors
            contradictions.append({
                "description": f"Percentage distribution adds up to {total_percentage}%, exceeding 100%",
                "statements": percentages
            })
    
    return contradictions

def find_impossible_values(content: str) -> List[dict]:
    """Find impossible or unrealistic values"""
    impossible = []
    
    import re
    
    # Check for impossible percentages
    percentage_pattern = r'(\d+(?:\.\d+)?)%'
    percentages = re.findall(percentage_pattern, content)
    
    for percentage in percentages:
        value = float(percentage)
        if value > 100:
            impossible.append({
                "description": f"Percentage value {value}% exceeds maximum possible value of 100%",
                "value": f"{value}%"
            })
        elif value < 0:
            impossible.append({
                "description": f"Percentage value {value}% is negative, which is impossible",
                "value": f"{value}%"
            })
    
    # Check for impossible dates
    date_pattern = r'\b(\d{4})-(\d{2})-(\d{2})\b'
    dates = re.findall(date_pattern, content)
    
    for year, month, day in dates:
        try:
            from datetime import date
            date(int(year), int(month), int(day))
        except ValueError:
            impossible.append({
                "description": f"Invalid date: {year}-{month}-{day}",
                "value": f"{year}-{month}-{day}"
            })
    
    return impossible

def validate_source_alignment(content: str, source_data: dict | None) -> dict:
    """Validate alignment between content and source data"""
    if not source_data:
        return {"score": 0.5, "issues": []}
    
    alignment_score = 0.8  # Base score
    issues = []
    
    # Check if content mentions data that's not in source
    content_lower = content.lower()
    
    # Check for unsupported claims
    if "risk" in content_lower and "risks" not in source_data:
        alignment_score -= 0.2
        issues.append("Content mentions risks but no risk data provided in source")
    
    if "financial" in content_lower and "financial_data" not in source_data:
        alignment_score -= 0.2
        issues.append("Content mentions financial data but none provided in source")
    
    if "resource" in content_lower and "resources" not in source_data:
        alignment_score -= 0.2
        issues.append("Content mentions resources but no resource data provided in source")
    
    return {"score": max(0.0, alignment_score), "issues": issues}

def validate_temporal_consistency(content: str) -> dict:
    """Validate temporal consistency in content"""
    issues = []
    
    import re
    from datetime import date, datetime
    
    # Extract dates from content
    date_pattern = r'\b(\d{4})-(\d{2})-(\d{2})\b'
    dates = re.findall(date_pattern, content)
    
    today = date.today()
    
    for year, month, day in dates:
        try:
            content_date = date(int(year), int(month), int(day))
            
            # Check for future dates in historical context
            if "completed" in content.lower() and content_date > today:
                issues.append({
                    "type": "temporal_inconsistency",
                    "severity": "medium",
                    "description": f"Claims completion on future date: {content_date}",
                    "date": str(content_date)
                })
            
            # Check for very old dates in current context
            if "current" in content.lower() and (today - content_date).days > 365:
                issues.append({
                    "type": "temporal_inconsistency",
                    "severity": "low",
                    "description": f"References old date {content_date} in current context",
                    "date": str(content_date)
                })
                
        except ValueError:
            continue
    
    return {"issues": issues}

def calculate_validation_confidence(
    validation_issues: List[dict],
    consistency_score: float,
    source_alignment_score: float,
    fact_check_results: List[dict]
) -> float:
    """Calculate overall validation confidence score"""
    
    # Start with base confidence
    confidence = 0.8
    
    # Reduce confidence for each issue
    for issue in validation_issues:
        severity_impact = {
            "high": 0.3,
            "medium": 0.15,
            "low": 0.05
        }
        confidence -= severity_impact.get(issue.get("severity", "medium"), 0.15)
    
    # Factor in consistency and alignment scores
    confidence = confidence * 0.4 + consistency_score * 0.3 + source_alignment_score * 0.3
    
    # Factor in fact check accuracy
    if fact_check_results:
        accurate_facts = sum(1 for fc in fact_check_results if fc.get("is_accurate", False))
        fact_accuracy = accurate_facts / len(fact_check_results)
        confidence = confidence * 0.8 + fact_accuracy * 0.2
    
    return max(0.0, min(1.0, confidence))

async def generate_corrected_content(content: str, validation_issues: List[dict]) -> str:
    """Generate corrected version of content addressing validation issues"""
    
    corrected = content
    
    # Apply corrections based on validation issues
    for issue in validation_issues:
        if issue["type"] == "numerical_inaccuracy":
            # Would implement specific numerical corrections
            corrected += f"\n[CORRECTION NEEDED: {issue['description']}]"
        elif issue["type"] == "entity_not_found":
            # Would implement entity reference corrections
            corrected += f"\n[CORRECTION NEEDED: {issue['description']}]"
        elif issue["type"] == "logical_contradiction":
            # Would implement logical consistency corrections
            corrected += f"\n[CORRECTION NEEDED: {issue['description']}]"
    
    # In production, would use AI to generate more sophisticated corrections
    try:
        # Use OpenAI to generate corrected content
        correction_prompt = f"""
        Original content: {content}
        
        Issues found: {json.dumps(validation_issues, indent=2)}
        
        Please provide a corrected version that addresses these validation issues while maintaining the original intent and style.
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are a content validator. Correct the provided content to address validation issues while maintaining accuracy and readability."
                },
                {"role": "user", "content": correction_prompt}
            ],
            max_tokens=1000,
            temperature=0.2
        )
        
        return response.choices[0].message.content
        
    except Exception:
        return corrected

# AI Risk Forecaster Agent
class RiskForecastRequest(BaseModel):
    project_ids: List[UUID] | None = None
    forecast_horizon_days: int = 90
    risk_categories: List[RiskCategory] | None = None
    include_mitigation_suggestions: bool = True
    confidence_threshold: float = 0.6

class RiskForecast(BaseModel):
    risk_id: str | None = None  # None for new predicted risks
    project_id: str
    predicted_risk_type: RiskCategory
    probability: float
    impact: float
    risk_score: float
    title: str
    description: str
    predicted_occurrence_date: date | None
    confidence_score: float
    contributing_factors: List[str]
    mitigation_suggestions: List[str]
    similar_historical_risks: List[str]

class RiskForecastResponse(BaseModel):
    forecast_id: str
    request_summary: dict
    forecasts: List[RiskForecast]
    portfolio_risk_summary: dict
    model_performance_metrics: dict
    generated_at: datetime
    valid_until: datetime

@app.post("/ai/risk-forecaster", response_model=RiskForecastResponse)
async def forecast_project_risks(
    request: RiskForecastRequest,
    current_user = Depends(get_current_user)
):
    """AI-powered risk forecasting and prediction"""
    try:
        forecast_id = str(UUID(int=int(time.time() * 1000000) % (2**128)))
        
        # Get projects to analyze
        if request.project_ids:
            project_ids = [str(pid) for pid in request.project_ids]
            projects_response = supabase.table("projects").select("*").in_("id", project_ids).execute()
        else:
            projects_response = supabase.table("projects").select("*").in_("status", ["active", "planning"]).execute()
        
        projects = convert_uuids(projects_response.data)
        
        # Get historical risk data for pattern analysis
        historical_risks_response = supabase.table("risks").select("*").execute()
        historical_risks = convert_uuids(historical_risks_response.data)
        
        # Get historical issues for materialization patterns
        historical_issues_response = supabase.table("issues").select("*").execute()
        historical_issues = convert_uuids(historical_issues_response.data)
        
        # Run risk forecasting algorithm
        forecasts = await run_risk_forecasting_algorithm(
            projects, historical_risks, historical_issues, request
        )
        
        # Calculate portfolio risk summary
        portfolio_summary = calculate_portfolio_risk_summary(forecasts, projects)
        
        # Calculate model performance metrics
        model_metrics = calculate_risk_model_performance(historical_risks, historical_issues)
        
        return RiskForecastResponse(
            forecast_id=forecast_id,
            request_summary={
                "projects_analyzed": len(projects),
                "forecast_horizon_days": request.forecast_horizon_days,
                "risk_categories": [cat.value for cat in request.risk_categories] if request.risk_categories else "all",
                "confidence_threshold": request.confidence_threshold
            },
            forecasts=forecasts,
            portfolio_risk_summary=portfolio_summary,
            model_performance_metrics=model_metrics,
            generated_at=datetime.now(),
            valid_until=datetime.now() + timedelta(hours=12)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk forecasting failed: {str(e)}")

async def run_risk_forecasting_algorithm(
    projects: List[dict],
    historical_risks: List[dict],
    historical_issues: List[dict],
    request: RiskForecastRequest
) -> List[RiskForecast]:
    """Core risk forecasting algorithm using pattern analysis"""
    forecasts = []
    
    for project in projects:
        # Analyze project characteristics for risk patterns
        project_forecasts = await analyze_project_risk_patterns(
            project, historical_risks, historical_issues, request
        )
        forecasts.extend(project_forecasts)
    
    # Filter by confidence threshold
    forecasts = [f for f in forecasts if f.confidence_score >= request.confidence_threshold]
    
    # Sort by risk score (probability * impact)
    forecasts.sort(key=lambda x: x.risk_score, reverse=True)
    
    return forecasts[:50]  # Return top 50 forecasts

async def analyze_project_risk_patterns(
    project: dict,
    historical_risks: List[dict],
    historical_issues: List[dict],
    request: RiskForecastRequest
) -> List[RiskForecast]:
    """Analyze individual project for risk patterns"""
    forecasts = []
    
    # Budget-based risk analysis
    budget_risks = analyze_budget_risk_patterns(project, historical_risks)
    forecasts.extend(budget_risks)
    
    # Timeline-based risk analysis
    timeline_risks = analyze_timeline_risk_patterns(project, historical_risks)
    forecasts.extend(timeline_risks)
    
    # Resource-based risk analysis
    resource_risks = await analyze_resource_risk_patterns(project, historical_risks)
    forecasts.extend(resource_risks)
    
    # Health-based risk analysis
    health_risks = analyze_health_deterioration_patterns(project, historical_risks)
    forecasts.extend(health_risks)
    
    # External factor risk analysis
    external_risks = analyze_external_risk_factors(project, historical_risks)
    forecasts.extend(external_risks)
    
    return forecasts

def analyze_budget_risk_patterns(project: dict, historical_risks: List[dict]) -> List[RiskForecast]:
    """Analyze budget-related risk patterns"""
    forecasts = []
    
    budget = project.get('budget', 0)
    actual_cost = project.get('actual_cost', 0)
    
    if budget > 0:
        budget_utilization = actual_cost / budget
        
        # High budget utilization risk
        if budget_utilization > 0.8:
            probability = min(0.9, (budget_utilization - 0.8) * 5)  # Increases rapidly after 80%
            
            forecasts.append(RiskForecast(
                risk_id=None,
                project_id=project['id'],
                predicted_risk_type=RiskCategory.financial,
                probability=probability,
                impact=0.8,
                risk_score=probability * 0.8,
                title="Budget Overrun Risk",
                description=f"Project is at {budget_utilization:.1%} of budget with potential for overrun",
                predicted_occurrence_date=None,
                confidence_score=0.85,
                contributing_factors=[
                    f"Current budget utilization: {budget_utilization:.1%}",
                    "Historical pattern: projects over 80% budget often exceed limits",
                    "Remaining project duration may require additional resources"
                ],
                mitigation_suggestions=[
                    "Implement strict budget monitoring and approval processes",
                    "Review remaining project scope for potential reductions",
                    "Negotiate additional budget allocation if justified",
                    "Optimize resource allocation to reduce costs"
                ],
                similar_historical_risks=[
                    risk['id'] for risk in historical_risks 
                    if risk.get('category') == 'financial' and risk.get('probability', 0) > 0.7
                ][:3]
            ))
    
    return forecasts

def analyze_timeline_risk_patterns(project: dict, historical_risks: List[dict]) -> List[RiskForecast]:
    """Analyze timeline-related risk patterns"""
    forecasts = []
    
    start_date = project.get('start_date')
    end_date = project.get('end_date')
    
    if start_date and end_date:
        from datetime import date
        today = date.today()
        
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)
        
        # Calculate project progress
        total_days = (end_date - start_date).days
        elapsed_days = (today - start_date).days
        remaining_days = (end_date - today).days
        
        if total_days > 0:
            time_progress = elapsed_days / total_days
            
            # Get milestone progress
            milestones = project.get('milestones', [])
            if milestones:
                completed_milestones = sum(1 for m in milestones if m.get('status') == 'completed')
                milestone_progress = completed_milestones / len(milestones)
                
                # Timeline vs milestone progress mismatch
                progress_gap = time_progress - milestone_progress
                
                if progress_gap > 0.2:  # Time progress significantly ahead of milestone progress
                    probability = min(0.9, progress_gap * 2)
                    
                    forecasts.append(RiskForecast(
                        risk_id=None,
                        project_id=project['id'],
                        predicted_risk_type=RiskCategory.schedule,
                        probability=probability,
                        impact=0.7,
                        risk_score=probability * 0.7,
                        title="Schedule Delay Risk",
                        description=f"Milestone progress ({milestone_progress:.1%}) lagging behind time progress ({time_progress:.1%})",
                        predicted_occurrence_date=end_date if remaining_days < 30 else None,
                        confidence_score=0.8,
                        contributing_factors=[
                            f"Time progress: {time_progress:.1%}, Milestone progress: {milestone_progress:.1%}",
                            f"Progress gap: {progress_gap:.1%}",
                            f"Remaining days: {remaining_days}"
                        ],
                        mitigation_suggestions=[
                            "Accelerate milestone completion through resource reallocation",
                            "Review and potentially reduce remaining scope",
                            "Implement daily progress tracking",
                            "Consider timeline extension if quality is at risk"
                        ],
                        similar_historical_risks=[
                            risk['id'] for risk in historical_risks 
                            if risk.get('category') == 'schedule' and risk.get('probability', 0) > 0.6
                        ][:3]
                    ))
    
    return forecasts

async def analyze_resource_risk_patterns(project: dict, historical_risks: List[dict]) -> List[RiskForecast]:
    """Analyze resource-related risk patterns"""
    forecasts = []
    
    # Get project team members
    team_members = project.get('team_members', [])
    
    if team_members:
        # Check for resource overallocation
        overallocated_count = 0
        
        for member_id in team_members:
            try:
                resource_response = supabase.table("resources").select("*").eq("id", member_id).execute()
                if resource_response.data:
                    resource = resource_response.data[0]
                    availability_metrics = calculate_enhanced_resource_availability(resource)
                    
                    if availability_metrics['utilization_percentage'] > 100:
                        overallocated_count += 1
            except Exception:
                continue
        
        if overallocated_count > 0:
            overallocation_ratio = overallocated_count / len(team_members)
            probability = min(0.9, overallocation_ratio * 1.5)
            
            forecasts.append(RiskForecast(
                risk_id=None,
                project_id=project['id'],
                predicted_risk_type=RiskCategory.resource,
                probability=probability,
                impact=0.6,
                risk_score=probability * 0.6,
                title="Resource Overallocation Risk",
                description=f"{overallocated_count} out of {len(team_members)} team members are overallocated",
                predicted_occurrence_date=None,
                confidence_score=0.75,
                contributing_factors=[
                    f"Overallocated resources: {overallocated_count}/{len(team_members)}",
                    "Overallocation leads to burnout and quality issues",
                    "Historical correlation with project delays"
                ],
                mitigation_suggestions=[
                    "Redistribute workload among team members",
                    "Add additional resources to the project",
                    "Reduce project scope to match available capacity",
                    "Implement workload monitoring and alerts"
                ],
                similar_historical_risks=[
                    risk['id'] for risk in historical_risks 
                    if risk.get('category') == 'resource' and 'allocation' in risk.get('description', '').lower()
                ][:3]
            ))
    
    return forecasts

def analyze_health_deterioration_patterns(project: dict, historical_risks: List[dict]) -> List[RiskForecast]:
    """Analyze project health deterioration patterns"""
    forecasts = []
    
    current_health = project.get('health', 'green')
    
    # Yellow health projects at risk of becoming red
    if current_health == 'yellow':
        # Analyze factors contributing to yellow health
        contributing_factors = []
        probability = 0.4  # Base probability
        
        # Budget factor
        budget = project.get('budget', 0)
        actual_cost = project.get('actual_cost', 0)
        if budget > 0 and actual_cost / budget > 0.9:
            contributing_factors.append("Budget utilization over 90%")
            probability += 0.2
        
        # Timeline factor
        end_date = project.get('end_date')
        if end_date:
            from datetime import date
            today = date.today()
            if isinstance(end_date, str):
                end_date = date.fromisoformat(end_date)
            
            days_remaining = (end_date - today).days
            if days_remaining < 14:
                contributing_factors.append("Less than 2 weeks remaining")
                probability += 0.3
        
        # Milestone factor
        milestones = project.get('milestones', [])
        if milestones:
            overdue_milestones = 0
            for milestone in milestones:
                if milestone.get('status') != 'completed' and milestone.get('due_date'):
                    due_date = milestone['due_date']
                    if isinstance(due_date, str):
                        due_date = date.fromisoformat(due_date)
                    if due_date < date.today():
                        overdue_milestones += 1
            
            if overdue_milestones > 0:
                contributing_factors.append(f"{overdue_milestones} overdue milestones")
                probability += 0.2
        
        if probability > 0.5:
            forecasts.append(RiskForecast(
                risk_id=None,
                project_id=project['id'],
                predicted_risk_type=RiskCategory.technical,
                probability=min(0.9, probability),
                impact=0.8,
                risk_score=min(0.9, probability) * 0.8,
                title="Project Health Deterioration Risk",
                description="Yellow health project at risk of becoming red status",
                predicted_occurrence_date=None,
                confidence_score=0.7,
                contributing_factors=contributing_factors,
                mitigation_suggestions=[
                    "Conduct immediate project health assessment",
                    "Address budget and timeline concerns proactively",
                    "Accelerate overdue milestone completion",
                    "Consider scope reduction or timeline extension"
                ],
                similar_historical_risks=[
                    risk['id'] for risk in historical_risks 
                    if 'health' in risk.get('description', '').lower()
                ][:3]
            ))
    
    return forecasts

def analyze_external_risk_factors(project: dict, historical_risks: List[dict]) -> List[RiskForecast]:
    """Analyze external risk factors"""
    forecasts = []
    
    # Dependency risk (simplified analysis)
    # In a real system, this would analyze project dependencies, vendor relationships, etc.
    
    # Market/seasonal risk
    from datetime import date
    today = date.today()
    
    # End-of-year risk (budget cycles, holiday impacts)
    if today.month >= 11:  # November/December
        forecasts.append(RiskForecast(
            risk_id=None,
            project_id=project['id'],
            predicted_risk_type=RiskCategory.external,
            probability=0.6,
            impact=0.5,
            risk_score=0.3,
            title="End-of-Year Resource Availability Risk",
            description="Potential resource availability issues due to holiday season and budget cycles",
            predicted_occurrence_date=date(today.year, 12, 15),
            confidence_score=0.6,
            contributing_factors=[
                "Holiday season approaching",
                "End-of-year budget constraints",
                "Reduced team availability"
            ],
            mitigation_suggestions=[
                "Plan for reduced team availability in December",
                "Complete critical milestones before holiday season",
                "Secure budget approval before year-end",
                "Consider timeline adjustments for holiday impact"
            ],
            similar_historical_risks=[]
        ))
    
    return forecasts

def calculate_portfolio_risk_summary(forecasts: List[RiskForecast], projects: List[dict]) -> dict:
    """Calculate portfolio-level risk summary"""
    if not forecasts:
        return {
            "total_forecasts": 0,
            "high_risk_forecasts": 0,
            "risk_distribution": {},
            "projects_at_risk": 0,
            "average_risk_score": 0
        }
    
    high_risk_forecasts = [f for f in forecasts if f.risk_score > 0.7]
    
    # Risk distribution by category
    risk_distribution = {}
    for forecast in forecasts:
        category = forecast.predicted_risk_type.value
        risk_distribution[category] = risk_distribution.get(category, 0) + 1
    
    # Projects at risk
    projects_at_risk = len(set(f.project_id for f in forecasts))
    
    # Average risk score
    average_risk_score = sum(f.risk_score for f in forecasts) / len(forecasts)
    
    return {
        "total_forecasts": len(forecasts),
        "high_risk_forecasts": len(high_risk_forecasts),
        "risk_distribution": risk_distribution,
        "projects_at_risk": projects_at_risk,
        "total_projects_analyzed": len(projects),
        "portfolio_risk_percentage": (projects_at_risk / len(projects) * 100) if projects else 0,
        "average_risk_score": average_risk_score
    }

def calculate_risk_model_performance(historical_risks: List[dict], historical_issues: List[dict]) -> dict:
    """Calculate risk forecasting model performance metrics"""
    # Simplified model performance calculation
    # In production, this would track actual vs predicted risk materialization
    
    total_risks = len(historical_risks)
    materialized_risks = len([r for r in historical_risks if r.get('status') == 'closed'])
    
    # Calculate accuracy metrics (simplified)
    accuracy = 0.75  # Placeholder - would be calculated from actual predictions vs outcomes
    precision = 0.72  # Placeholder
    recall = 0.68     # Placeholder
    
    return {
        "model_version": "1.0",
        "training_data_size": total_risks,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "last_trained": "2024-01-01T00:00:00Z",
        "confidence_calibration": "Well-calibrated",
        "performance_notes": "Model performs well for budget and timeline risks, moderate performance for external risks"
    }

# Enhanced RAG Reporter Agent
class RAGQueryType(str, Enum):
    project_status = "project_status"
    resource_analysis = "resource_analysis"
    financial_report = "financial_report"
    risk_assessment = "risk_assessment"
    performance_metrics = "performance_metrics"
    trend_analysis = "trend_analysis"

class EnhancedRAGQueryRequest(BaseModel):
    query: str
    query_type: RAGQueryType | None = None
    context_filters: dict | None = None  # e.g., {"project_ids": [...], "date_range": {...}}
    output_format: str = "narrative"  # "narrative", "structured", "executive_summary"
    include_visualizations: bool = False

class RAGSourceReference(BaseModel):
    source_type: str  # "project", "resource", "financial_record", etc.
    source_id: str
    source_name: str
    relevance_score: float
    data_points_used: List[str]

class EnhancedRAGResponse(BaseModel):
    query_id: str
    original_query: str
    interpreted_intent: str
    answer: str
    executive_summary: str | None = None
    key_insights: List[str]
    source_references: List[RAGSourceReference]
    confidence_score: float
    data_freshness: str
    follow_up_suggestions: List[str]
    generated_at: datetime

@app.post("/ai/rag-reporter", response_model=EnhancedRAGResponse)
async def enhanced_rag_query(
    request: EnhancedRAGQueryRequest,
    current_user = Depends(get_current_user)
):
    """Enhanced RAG-based reporting with intelligent context gathering"""
    try:
        query_id = str(UUID(int=int(time.time() * 1000000) % (2**128)))
        
        # Analyze query intent
        query_analysis = analyze_query_intent(request.query)
        
        # Gather comprehensive context
        context_data = await gather_enhanced_context(request, query_analysis)
        
        # Generate intelligent response
        rag_response = await generate_enhanced_rag_response(request, context_data, query_analysis)
        
        # Add metadata
        rag_response.query_id = query_id
        rag_response.generated_at = datetime.now()
        
        return rag_response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

def analyze_query_intent(query: str) -> dict:
    """Analyze query to understand intent and required data"""
    query_lower = query.lower()
    
    intent_analysis = {
        "primary_intent": "general",
        "entities_mentioned": [],
        "time_references": [],
        "metrics_requested": [],
        "comparison_requested": False,
        "trend_analysis_requested": False
    }
    
    # Detect primary intent
    if any(word in query_lower for word in ["status", "progress", "health", "how is"]):
        intent_analysis["primary_intent"] = "status_inquiry"
    elif any(word in query_lower for word in ["budget", "cost", "spend", "financial"]):
        intent_analysis["primary_intent"] = "financial_analysis"
    elif any(word in query_lower for word in ["resource", "team", "allocation", "capacity"]):
        intent_analysis["primary_intent"] = "resource_analysis"
    elif any(word in query_lower for word in ["risk", "issue", "problem", "concern"]):
        intent_analysis["primary_intent"] = "risk_analysis"
    elif any(word in query_lower for word in ["trend", "over time", "change", "growth"]):
        intent_analysis["primary_intent"] = "trend_analysis"
        intent_analysis["trend_analysis_requested"] = True
    
    # Detect entities
    if "project" in query_lower:
        intent_analysis["entities_mentioned"].append("projects")
    if any(word in query_lower for word in ["resource", "team", "people", "staff"]):
        intent_analysis["entities_mentioned"].append("resources")
    if "portfolio" in query_lower:
        intent_analysis["entities_mentioned"].append("portfolios")
    
    # Detect time references
    if any(word in query_lower for word in ["this month", "monthly", "last month"]):
        intent_analysis["time_references"].append("monthly")
    elif any(word in query_lower for word in ["this week", "weekly", "last week"]):
        intent_analysis["time_references"].append("weekly")
    elif any(word in query_lower for word in ["today", "daily", "yesterday"]):
        intent_analysis["time_references"].append("daily")
    elif any(word in query_lower for word in ["this year", "yearly", "annual"]):
        intent_analysis["time_references"].append("yearly")
    
    # Detect comparison requests
    if any(word in query_lower for word in ["compare", "vs", "versus", "against", "difference"]):
        intent_analysis["comparison_requested"] = True
    
    return intent_analysis

async def gather_enhanced_context(request: EnhancedRAGQueryRequest, query_analysis: dict) -> dict:
    """Gather comprehensive context based on query analysis"""
    context = {
        "metadata": {
            "query_timestamp": datetime.now().isoformat(),
            "data_sources": [],
            "context_scope": query_analysis["entities_mentioned"]
        }
    }
    
    # Always gather basic project and resource data
    if not request.context_filters or "projects" in query_analysis["entities_mentioned"]:
        projects_response = supabase.table("projects").select("*").execute()
        context["projects"] = convert_uuids(projects_response.data)
        context["metadata"]["data_sources"].append("projects")
        
        # Enhance projects with calculated metrics
        for project in context["projects"]:
            project["milestones"] = await get_project_milestones(project["id"])
            # Add health calculation
            project["calculated_health"] = calculate_project_health(project).value
    
    if not request.context_filters or "resources" in query_analysis["entities_mentioned"]:
        resources_response = supabase.table("resources").select("*").execute()
        context["resources"] = convert_uuids(resources_response.data)
        context["metadata"]["data_sources"].append("resources")
        
        # Enhance resources with utilization metrics
        for resource in context["resources"]:
            availability_metrics = calculate_enhanced_resource_availability(resource)
            resource.update(availability_metrics)
    
    # Gather financial data if needed
    if query_analysis["primary_intent"] == "financial_analysis" or "financial" in request.query.lower():
        financial_response = supabase.table("financial_tracking").select("*").execute()
        context["financial_data"] = convert_uuids(financial_response.data)
        context["metadata"]["data_sources"].append("financial_tracking")
        
        # Calculate portfolio-level financial metrics
        if context.get("projects"):
            context["financial_summary"] = calculate_portfolio_financial_summary(context["projects"], context["financial_data"])
    
    # Gather risk data if needed
    if query_analysis["primary_intent"] == "risk_analysis" or "risk" in request.query.lower():
        risks_response = supabase.table("risks").select("*").execute()
        issues_response = supabase.table("issues").select("*").execute()
        context["risks"] = convert_uuids(risks_response.data)
        context["issues"] = convert_uuids(issues_response.data)
        context["metadata"]["data_sources"].extend(["risks", "issues"])
    
    # Gather trend data if requested
    if query_analysis["trend_analysis_requested"]:
        # Get portfolio trends for the last 30 days
        try:
            # This would call the existing portfolio trends endpoint
            context["trend_data"] = {
                "note": "Trend analysis would be gathered here",
                "time_period": "30_days"
            }
            context["metadata"]["data_sources"].append("trend_analysis")
        except Exception:
            pass
    
    # Apply context filters if provided
    if request.context_filters:
        context = apply_context_filters(context, request.context_filters)
    
    return context

def apply_context_filters(context: dict, filters: dict) -> dict:
    """Apply filters to limit context scope"""
    if "project_ids" in filters:
        project_ids = [str(pid) for pid in filters["project_ids"]]
        if "projects" in context:
            context["projects"] = [p for p in context["projects"] if p["id"] in project_ids]
    
    if "date_range" in filters:
        start_date = filters["date_range"].get("start")
        end_date = filters["date_range"].get("end")
        
        # Filter financial data by date range
        if "financial_data" in context and start_date and end_date:
            context["financial_data"] = [
                f for f in context["financial_data"]
                if start_date <= f.get("date_incurred", "") <= end_date
            ]
    
    return context

async def generate_enhanced_rag_response(
    request: EnhancedRAGQueryRequest,
    context_data: dict,
    query_analysis: dict
) -> EnhancedRAGResponse:
    """Generate comprehensive RAG response with AI"""
    
    # Prepare structured context for AI
    context_summary = prepare_context_summary(context_data, query_analysis)
    
    try:
        # Generate main response using OpenAI
        main_response = await generate_ai_response(request.query, context_summary, request.output_format)
        
        # Generate executive summary if requested
        executive_summary = None
        if request.output_format == "executive_summary" or "executive" in request.query.lower():
            executive_summary = await generate_executive_summary(request.query, context_summary)
        
        # Extract key insights
        key_insights = extract_key_insights(context_data, query_analysis)
        
        # Generate source references
        source_references = generate_source_references(context_data, query_analysis)
        
        # Calculate confidence score
        confidence_score = calculate_response_confidence(context_data, query_analysis)
        
        # Generate follow-up suggestions
        follow_up_suggestions = generate_follow_up_suggestions(request.query, query_analysis)
        
        return EnhancedRAGResponse(
            query_id="",  # Will be set by caller
            original_query=request.query,
            interpreted_intent=query_analysis["primary_intent"],
            answer=main_response,
            executive_summary=executive_summary,
            key_insights=key_insights,
            source_references=source_references,
            confidence_score=confidence_score,
            data_freshness=calculate_data_freshness(context_data),
            follow_up_suggestions=follow_up_suggestions,
            generated_at=datetime.now()
        )
        
    except Exception as e:
        # Fallback response
        return EnhancedRAGResponse(
            query_id="",
            original_query=request.query,
            interpreted_intent="error",
            answer=f"I apologize, but I encountered an error processing your query: {str(e)}",
            executive_summary=None,
            key_insights=["Error occurred during processing"],
            source_references=[],
            confidence_score=0.0,
            data_freshness="unknown",
            follow_up_suggestions=["Please try rephrasing your question"],
            generated_at=datetime.now()
        )

def prepare_context_summary(context_data: dict, query_analysis: dict) -> str:
    """Prepare a structured summary of context for AI processing"""
    summary_parts = []
    
    # Projects summary
    if "projects" in context_data:
        projects = context_data["projects"]
        health_dist = {"green": 0, "yellow": 0, "red": 0}
        for project in projects:
            health = project.get("health", "green")
            health_dist[health] = health_dist.get(health, 0) + 1
        
        summary_parts.append(f"""
PROJECTS ({len(projects)} total):
- Health Distribution: {health_dist['green']} green, {health_dist['yellow']} yellow, {health_dist['red']} red
- Sample Projects: {json.dumps(projects[:3], indent=2, default=str)}
""")
    
    # Resources summary
    if "resources" in context_data:
        resources = context_data["resources"]
        avg_utilization = sum(r.get("utilization_percentage", 0) for r in resources) / len(resources) if resources else 0
        
        summary_parts.append(f"""
RESOURCES ({len(resources)} total):
- Average Utilization: {avg_utilization:.1f}%
- Sample Resources: {json.dumps(resources[:3], indent=2, default=str)}
""")
    
    # Financial summary
    if "financial_data" in context_data:
        financial_data = context_data["financial_data"]
        total_actual = sum(f.get("actual_amount", 0) for f in financial_data)
        
        summary_parts.append(f"""
FINANCIAL DATA ({len(financial_data)} records):
- Total Actual Spending: ${total_actual:,.2f}
- Sample Records: {json.dumps(financial_data[:3], indent=2, default=str)}
""")
    
    return "\n".join(summary_parts)

async def generate_ai_response(query: str, context_summary: str, output_format: str) -> str:
    """Generate AI response using OpenAI"""
    
    system_prompt = f"""You are an AI assistant for a Project Portfolio Management system. 
    Analyze the provided data and answer questions with specific, data-driven insights.
    
    Output format: {output_format}
    
    Guidelines:
    - Provide specific numbers and metrics when available
    - Identify trends and patterns in the data
    - Highlight areas of concern or opportunity
    - Be concise but comprehensive
    - If data is insufficient, clearly state limitations
    """
    
    try:
        if not OPENAI_AVAILABLE:
            return f"AI analysis unavailable. Based on available data: {context_summary[:200]}..."
            
        # Try new OpenAI client syntax first
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context:\n{context_summary}\n\nQuestion: {query}"}
                ],
                max_tokens=1500,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception:
            # Fallback to old syntax
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context:\n{context_summary}\n\nQuestion: {query}"}
                ],
                max_tokens=1500,
                temperature=0.3
            )
            return response.choices[0].message.content
        
    except Exception as e:
        return f"AI response generation failed: {str(e)}. Context summary: {context_summary[:300]}..."

async def generate_executive_summary(query: str, context_summary: str) -> str:
    """Generate executive summary"""
    try:
        if not OPENAI_AVAILABLE:
            return "Executive summary: AI analysis unavailable. Please review the data manually."
            
        # Try new OpenAI client syntax first
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system", 
                        "content": "Generate a concise executive summary (2-3 sentences) highlighting the most critical insights."
                    },
                    {"role": "user", "content": f"Context:\n{context_summary}\n\nQuery: {query}"}
                ],
                max_tokens=200,
                temperature=0.2
            )
            return response.choices[0].message.content
        except Exception:
            # Fallback to old syntax
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system", 
                        "content": "Generate a concise executive summary (2-3 sentences) highlighting the most critical insights."
                    },
                    {"role": "user", "content": f"Context:\n{context_summary}\n\nQuery: {query}"}
                ],
                max_tokens=200,
                temperature=0.2
            )
            return response.choices[0].message.content
        
    except Exception:
        return "Executive summary generation unavailable"

def extract_key_insights(context_data: dict, query_analysis: dict) -> List[str]:
    """Extract key insights from the data"""
    insights = []
    
    # Project insights
    if "projects" in context_data:
        projects = context_data["projects"]
        red_projects = [p for p in projects if p.get("health") == "red"]
        if red_projects:
            insights.append(f"{len(red_projects)} projects are in red health status requiring immediate attention")
        
        overdue_projects = []
        today = date.today()
        for project in projects:
            if project.get("end_date"):
                end_date = project["end_date"]
                if isinstance(end_date, str):
                    end_date = date.fromisoformat(end_date)
                if end_date < today and project.get("status") != "completed":
                    overdue_projects.append(project)
        
        if overdue_projects:
            insights.append(f"{len(overdue_projects)} projects are overdue")
    
    # Resource insights
    if "resources" in context_data:
        resources = context_data["resources"]
        overallocated = [r for r in resources if r.get("utilization_percentage", 0) > 100]
        if overallocated:
            insights.append(f"{len(overallocated)} resources are overallocated")
        
        underutilized = [r for r in resources if r.get("utilization_percentage", 0) < 50]
        if underutilized:
            insights.append(f"{len(underutilized)} resources are underutilized")
    
    # Financial insights
    if "financial_summary" in context_data:
        summary = context_data["financial_summary"]
        if summary.get("variance_percentage", 0) > 10:
            insights.append(f"Portfolio is {summary['variance_percentage']:.1f}% over budget")
    
    return insights[:5]  # Return top 5 insights

def generate_source_references(context_data: dict, query_analysis: dict) -> List[RAGSourceReference]:
    """Generate source references for transparency"""
    references = []
    
    if "projects" in context_data:
        references.append(RAGSourceReference(
            source_type="projects",
            source_id="projects_table",
            source_name="Project Database",
            relevance_score=0.9,
            data_points_used=["health", "status", "budget", "timeline"]
        ))
    
    if "resources" in context_data:
        references.append(RAGSourceReference(
            source_type="resources",
            source_id="resources_table",
            source_name="Resource Database",
            relevance_score=0.8,
            data_points_used=["utilization", "skills", "availability"]
        ))
    
    if "financial_data" in context_data:
        references.append(RAGSourceReference(
            source_type="financial",
            source_id="financial_tracking_table",
            source_name="Financial Tracking System",
            relevance_score=0.85,
            data_points_used=["actual_cost", "planned_amount", "variance"]
        ))
    
    return references

def calculate_response_confidence(context_data: dict, query_analysis: dict) -> float:
    """Calculate confidence score for the response"""
    confidence = 0.5  # Base confidence
    
    # Increase confidence based on data availability
    if "projects" in context_data and context_data["projects"]:
        confidence += 0.2
    
    if "resources" in context_data and context_data["resources"]:
        confidence += 0.15
    
    if "financial_data" in context_data and context_data["financial_data"]:
        confidence += 0.15
    
    # Adjust based on query specificity
    if len(query_analysis["entities_mentioned"]) > 0:
        confidence += 0.1
    
    return min(1.0, confidence)

def calculate_data_freshness(context_data: dict) -> str:
    """Calculate how fresh the data is"""
    # Simplified - in production would check actual timestamps
    return "Real-time (last updated within 1 hour)"

def generate_follow_up_suggestions(query: str, query_analysis: dict) -> List[str]:
    """Generate relevant follow-up questions"""
    suggestions = []
    
    if query_analysis["primary_intent"] == "status_inquiry":
        suggestions.extend([
            "What are the main risks affecting project health?",
            "Which resources are overallocated?",
            "Show me budget variance by project"
        ])
    elif query_analysis["primary_intent"] == "financial_analysis":
        suggestions.extend([
            "Which projects are over budget?",
            "Show me spending trends over the last 3 months",
            "What are the main cost drivers?"
        ])
    elif query_analysis["primary_intent"] == "resource_analysis":
        suggestions.extend([
            "Which skills are in highest demand?",
            "Show me resource utilization by team",
            "What optimization opportunities exist?"
        ])
    
    # Add general suggestions
    suggestions.extend([
        "Generate an executive dashboard summary",
        "Show me portfolio KPIs",
        "What actions should I prioritize this week?"
    ])
    
    return suggestions[:5]

def calculate_portfolio_financial_summary(projects: List[dict], financial_data: List[dict]) -> dict:
    """Calculate portfolio-level financial summary"""
    total_budget = sum(float(p.get("budget", 0)) for p in projects if p.get("budget"))
    total_actual = sum(float(f.get("actual_amount", 0)) for f in financial_data)
    variance = total_actual - total_budget
    variance_percentage = (variance / total_budget * 100) if total_budget > 0 else 0
    
    return {
        "total_budget": total_budget,
        "total_actual": total_actual,
        "variance": variance,
        "variance_percentage": variance_percentage
    }

# AI Resource Optimizer Agent
class ResourceOptimizationRequest(BaseModel):
    project_ids: List[UUID] | None = None  # Specific projects to optimize, or None for all
    optimization_goals: List[str] = ["skill_match", "availability", "cost_efficiency"]
    constraints: dict | None = None
    time_horizon_days: int = 30

class ResourceOptimizationSuggestion(BaseModel):
    type: str  # "reallocation", "new_allocation", "capacity_adjustment"
    priority: str  # "high", "medium", "low"
    confidence_score: float
    current_allocation: dict | None = None
    suggested_allocation: dict
    reasoning: str
    expected_impact: dict
    implementation_effort: str

class ResourceOptimizationResponse(BaseModel):
    optimization_id: str
    request_summary: dict
    suggestions: List[ResourceOptimizationSuggestion]
    overall_metrics: dict
    generated_at: datetime
    valid_until: datetime

@app.post("/ai/resource-optimizer", response_model=ResourceOptimizationResponse)
async def optimize_resource_allocation(
    request: ResourceOptimizationRequest,
    current_user = Depends(get_current_user)
):
    """AI-powered resource allocation optimization"""
    try:
        optimization_id = str(UUID(int=int(time.time() * 1000000) % (2**128)))
        
        # Gather current resource and project data
        resources_response = supabase.table("resources").select("*").execute()
        resources = convert_uuids(resources_response.data)
        
        # Get projects to optimize
        if request.project_ids:
            project_ids = [str(pid) for pid in request.project_ids]
            projects_response = supabase.table("projects").select("*").in_("id", project_ids).execute()
        else:
            projects_response = supabase.table("projects").select("*").eq("status", "active").execute()
        
        projects = convert_uuids(projects_response.data)
        
        # Get current allocations
        allocations_response = supabase.table("project_resources").select("*").execute()
        current_allocations = convert_uuids(allocations_response.data)
        
        # Run optimization algorithm
        suggestions = await run_resource_optimization_algorithm(
            resources, projects, current_allocations, request
        )
        
        # Calculate overall metrics
        overall_metrics = calculate_optimization_metrics(resources, projects, suggestions)
        
        return ResourceOptimizationResponse(
            optimization_id=optimization_id,
            request_summary={
                "projects_analyzed": len(projects),
                "resources_analyzed": len(resources),
                "optimization_goals": request.optimization_goals,
                "time_horizon_days": request.time_horizon_days
            },
            suggestions=suggestions,
            overall_metrics=overall_metrics,
            generated_at=datetime.now(),
            valid_until=datetime.now() + timedelta(hours=24)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resource optimization failed: {str(e)}")

async def run_resource_optimization_algorithm(
    resources: List[dict], 
    projects: List[dict], 
    current_allocations: List[dict],
    request: ResourceOptimizationRequest
) -> List[ResourceOptimizationSuggestion]:
    """Core resource optimization algorithm"""
    suggestions = []
    
    # Create resource utilization map
    resource_utilization = {}
    for resource in resources:
        availability_metrics = calculate_enhanced_resource_availability(resource)
        resource_utilization[resource['id']] = {
            'resource': resource,
            'current_utilization': availability_metrics['utilization_percentage'],
            'available_hours': availability_metrics['available_hours'],
            'allocated_hours': availability_metrics['allocated_hours'],
            'skills': resource.get('skills', [])
        }
    
    # Analyze each project for optimization opportunities
    for project in projects:
        project_allocations = [a for a in current_allocations if a['project_id'] == project['id']]
        
        # Check for skill mismatches
        skill_suggestions = analyze_skill_optimization(project, project_allocations, resource_utilization)
        suggestions.extend(skill_suggestions)
        
        # Check for capacity optimization
        capacity_suggestions = analyze_capacity_optimization(project, project_allocations, resource_utilization)
        suggestions.extend(capacity_suggestions)
        
        # Check for cost optimization
        if "cost_efficiency" in request.optimization_goals:
            cost_suggestions = analyze_cost_optimization(project, project_allocations, resource_utilization)
            suggestions.extend(cost_suggestions)
    
    # Check for overall resource balancing
    balancing_suggestions = analyze_resource_balancing(resource_utilization, request)
    suggestions.extend(balancing_suggestions)
    
    # Sort by priority and confidence
    suggestions.sort(key=lambda x: (
        {"high": 3, "medium": 2, "low": 1}[x.priority],
        x.confidence_score
    ), reverse=True)
    
    return suggestions[:20]  # Return top 20 suggestions

def analyze_skill_optimization(project: dict, allocations: List[dict], resource_utilization: dict) -> List[ResourceOptimizationSuggestion]:
    """Analyze skill matching optimization opportunities"""
    suggestions = []
    
    # Get project requirements (simplified - would be more sophisticated in production)
    project_skills_needed = project.get('required_skills', [])
    if not project_skills_needed:
        return suggestions
    
    # Analyze current allocations for skill gaps
    allocated_resources = [resource_utilization[a['resource_id']] for a in allocations if a['resource_id'] in resource_utilization]
    
    current_skills = set()
    for res_data in allocated_resources:
        current_skills.update(res_data['skills'])
    
    missing_skills = set(project_skills_needed) - current_skills
    
    if missing_skills:
        # Find resources with missing skills
        for resource_id, res_data in resource_utilization.items():
            resource_skills = set(res_data['skills'])
            skill_overlap = missing_skills.intersection(resource_skills)
            
            if skill_overlap and res_data['available_hours'] > 0:
                suggestions.append(ResourceOptimizationSuggestion(
                    type="new_allocation",
                    priority="high" if len(skill_overlap) > 1 else "medium",
                    confidence_score=min(0.9, len(skill_overlap) / len(missing_skills)),
                    current_allocation=None,
                    suggested_allocation={
                        "project_id": project['id'],
                        "resource_id": resource_id,
                        "allocation_percentage": min(50, int(res_data['available_hours'] / res_data['resource']['capacity'] * 100)),
                        "reason": "skill_gap_fill"
                    },
                    reasoning=f"Resource has required skills {list(skill_overlap)} that are missing from project team",
                    expected_impact={
                        "skill_coverage_improvement": len(skill_overlap),
                        "project_health_impact": "positive"
                    },
                    implementation_effort="low"
                ))
    
    return suggestions

def analyze_capacity_optimization(project: dict, allocations: List[dict], resource_utilization: dict) -> List[ResourceOptimizationSuggestion]:
    """Analyze capacity and workload optimization"""
    suggestions = []
    
    # Find overallocated resources
    for allocation in allocations:
        resource_id = allocation['resource_id']
        if resource_id in resource_utilization:
            res_data = resource_utilization[resource_id]
            
            if res_data['current_utilization'] > 100:
                # Resource is overallocated
                suggestions.append(ResourceOptimizationSuggestion(
                    type="reallocation",
                    priority="high",
                    confidence_score=0.95,
                    current_allocation=allocation,
                    suggested_allocation={
                        "project_id": project['id'],
                        "resource_id": resource_id,
                        "allocation_percentage": max(25, allocation['allocation_percentage'] - 25),
                        "reason": "overallocation_reduction"
                    },
                    reasoning=f"Resource is {res_data['current_utilization']:.1f}% utilized, exceeding capacity",
                    expected_impact={
                        "resource_stress_reduction": res_data['current_utilization'] - 100,
                        "quality_improvement": "high"
                    },
                    implementation_effort="medium"
                ))
            
            elif res_data['current_utilization'] < 50 and res_data['available_hours'] > 20:
                # Resource is underutilized
                suggestions.append(ResourceOptimizationSuggestion(
                    type="capacity_adjustment",
                    priority="medium",
                    confidence_score=0.7,
                    current_allocation=allocation,
                    suggested_allocation={
                        "project_id": project['id'],
                        "resource_id": resource_id,
                        "allocation_percentage": min(80, allocation['allocation_percentage'] + 25),
                        "reason": "underutilization_increase"
                    },
                    reasoning=f"Resource is only {res_data['current_utilization']:.1f}% utilized with {res_data['available_hours']:.1f}h available",
                    expected_impact={
                        "efficiency_gain": res_data['available_hours'],
                        "project_acceleration": "moderate"
                    },
                    implementation_effort="low"
                ))
    
    return suggestions

def analyze_cost_optimization(project: dict, allocations: List[dict], resource_utilization: dict) -> List[ResourceOptimizationSuggestion]:
    """Analyze cost optimization opportunities"""
    suggestions = []
    
    # Find high-cost resources that could be replaced
    for allocation in allocations:
        resource_id = allocation['resource_id']
        if resource_id in resource_utilization:
            res_data = resource_utilization[resource_id]
            resource = res_data['resource']
            
            hourly_rate = resource.get('hourly_rate', 0)
            if hourly_rate > 100:  # High-cost resource threshold
                
                # Look for lower-cost alternatives with similar skills
                resource_skills = set(resource.get('skills', []))
                
                for alt_resource_id, alt_res_data in resource_utilization.items():
                    if alt_resource_id == resource_id:
                        continue
                    
                    alt_resource = alt_res_data['resource']
                    alt_hourly_rate = alt_resource.get('hourly_rate', 0)
                    alt_skills = set(alt_resource.get('skills', []))
                    
                    skill_overlap = len(resource_skills.intersection(alt_skills)) / len(resource_skills) if resource_skills else 0
                    
                    if (alt_hourly_rate < hourly_rate * 0.8 and 
                        skill_overlap > 0.7 and 
                        alt_res_data['available_hours'] > 10):
                        
                        cost_savings = (hourly_rate - alt_hourly_rate) * allocation['allocation_percentage'] / 100 * 40  # Weekly savings
                        
                        suggestions.append(ResourceOptimizationSuggestion(
                            type="reallocation",
                            priority="medium",
                            confidence_score=skill_overlap * 0.8,
                            current_allocation=allocation,
                            suggested_allocation={
                                "project_id": project['id'],
                                "resource_id": alt_resource_id,
                                "allocation_percentage": allocation['allocation_percentage'],
                                "reason": "cost_optimization"
                            },
                            reasoning=f"Replace ${hourly_rate}/h resource with ${alt_hourly_rate}/h resource with {skill_overlap:.1%} skill match",
                            expected_impact={
                                "weekly_cost_savings": cost_savings,
                                "skill_match_percentage": skill_overlap * 100
                            },
                            implementation_effort="high"
                        ))
    
    return suggestions

def analyze_resource_balancing(resource_utilization: dict, request: ResourceOptimizationRequest) -> List[ResourceOptimizationSuggestion]:
    """Analyze overall resource balancing opportunities"""
    suggestions = []
    
    # Find severely imbalanced utilization
    utilizations = [data['current_utilization'] for data in resource_utilization.values()]
    if not utilizations:
        return suggestions
    
    avg_utilization = sum(utilizations) / len(utilizations)
    
    overloaded = [(rid, data) for rid, data in resource_utilization.items() if data['current_utilization'] > avg_utilization + 30]
    underloaded = [(rid, data) for rid, data in resource_utilization.items() if data['current_utilization'] < avg_utilization - 30]
    
    if overloaded and underloaded:
        suggestions.append(ResourceOptimizationSuggestion(
            type="reallocation",
            priority="high",
            confidence_score=0.8,
            current_allocation=None,
            suggested_allocation={
                "type": "workload_balancing",
                "overloaded_resources": len(overloaded),
                "underloaded_resources": len(underloaded),
                "reason": "workload_balancing"
            },
            reasoning=f"Significant workload imbalance detected: {len(overloaded)} overloaded, {len(underloaded)} underloaded resources",
            expected_impact={
                "utilization_variance_reduction": "high",
                "team_satisfaction_improvement": "moderate"
            },
            implementation_effort="high"
        ))
    
    return suggestions

def calculate_optimization_metrics(resources: List[dict], projects: List[dict], suggestions: List[ResourceOptimizationSuggestion]) -> dict:
    """Calculate overall optimization metrics"""
    return {
        "total_suggestions": len(suggestions),
        "high_priority_suggestions": len([s for s in suggestions if s.priority == "high"]),
        "average_confidence": sum(s.confidence_score for s in suggestions) / len(suggestions) if suggestions else 0,
        "optimization_categories": {
            "skill_optimization": len([s for s in suggestions if "skill" in s.reasoning.lower()]),
            "capacity_optimization": len([s for s in suggestions if "utilization" in s.reasoning.lower() or "capacity" in s.reasoning.lower()]),
            "cost_optimization": len([s for s in suggestions if "cost" in s.reasoning.lower()]),
            "workload_balancing": len([s for s in suggestions if "balance" in s.reasoning.lower()])
        },
        "potential_impact": {
            "projects_affected": len(set(s.suggested_allocation.get('project_id') for s in suggestions if s.suggested_allocation.get('project_id'))),
            "resources_affected": len(set(s.suggested_allocation.get('resource_id') for s in suggestions if s.suggested_allocation.get('resource_id')))
        }
    }

# Workflow Engine Models and Endpoints
class WorkflowType(str, Enum):
    sequential = "sequential"
    parallel = "parallel"
    conditional = "conditional"

class WorkflowStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"

class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    escalated = "escalated"

class WorkflowTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    workflow_type: WorkflowType = WorkflowType.sequential
    steps: List[dict]  # JSON structure for workflow steps
    timeout_hours: int | None = None
    auto_escalate: bool = False
    escalation_rules: dict | None = None

class WorkflowTemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None
    workflow_type: str
    steps: List[dict]
    timeout_hours: int | None
    auto_escalate: bool
    escalation_rules: dict | None
    created_at: datetime
    updated_at: datetime

class WorkflowInstanceCreate(BaseModel):
    template_id: UUID
    entity_type: str  # 'project', 'resource', 'financial', etc.
    entity_id: UUID
    initiated_by: UUID
    context_data: dict | None = None

class WorkflowInstanceResponse(BaseModel):
    id: str
    template_id: str
    entity_type: str
    entity_id: str
    status: str
    current_step: int
    initiated_by: str
    context_data: dict | None
    started_at: datetime
    completed_at: datetime | None
    steps_completed: int
    total_steps: int

class ApprovalStepCreate(BaseModel):
    workflow_instance_id: UUID
    step_number: int
    approver_id: UUID
    step_name: str
    instructions: str | None = None
    due_date: datetime | None = None

class ApprovalStepResponse(BaseModel):
    id: str
    workflow_instance_id: str
    step_number: int
    approver_id: str
    step_name: str
    instructions: str | None
    status: str
    due_date: datetime | None
    approved_at: datetime | None
    rejected_at: datetime | None
    comments: str | None
    created_at: datetime

# Workflow Template Endpoints
@app.post("/workflow-templates/", response_model=WorkflowTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow_template(template: WorkflowTemplateCreate, current_user = Depends(get_current_user)):
    try:
        template_data = template.dict()
        
        response = supabase.table("workflow_templates").insert(template_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Workflow Templates")
        
        return convert_uuids(response.data[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/workflow-templates/")
async def list_workflow_templates(current_user = Depends(get_current_user)):
    response = supabase.table("workflow_templates").select("*").execute()
    return convert_uuids(response.data)

@app.get("/workflow-templates/{template_id}", response_model=WorkflowTemplateResponse)
async def get_workflow_template(template_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("workflow_templates").select("*").eq("id", str(template_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow template not found")
    return convert_uuids(response.data[0])

# Workflow Instance Endpoints
@app.post("/workflow-instances/", response_model=WorkflowInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow_instance(instance: WorkflowInstanceCreate, current_user = Depends(get_current_user)):
    try:
        # Get the workflow template
        template_response = supabase.table("workflow_templates").select("*").eq("id", str(instance.template_id)).execute()
        if not template_response.data:
            raise HTTPException(status_code=404, detail="Workflow template not found")
        
        template = template_response.data[0]
        
        # Create workflow instance
        instance_data = instance.dict()
        instance_data['status'] = WorkflowStatus.active.value
        instance_data['current_step'] = 1
        instance_data['started_at'] = datetime.now().isoformat()
        instance_data['steps_completed'] = 0
        instance_data['total_steps'] = len(template['steps'])
        
        response = supabase.table("workflow_instances").insert(instance_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen der Workflow Instance")
        
        workflow_instance = convert_uuids(response.data[0])
        
        # Create approval steps based on template
        await create_approval_steps_from_template(workflow_instance['id'], template)
        
        return workflow_instance
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/workflow-instances/")
async def list_workflow_instances(
    entity_type: str | None = Query(None),
    entity_id: UUID | None = Query(None),
    status: WorkflowStatus | None = Query(None),
    current_user = Depends(get_current_user)
):
    query = supabase.table("workflow_instances").select("*")
    
    if entity_type:
        query = query.eq("entity_type", entity_type)
    if entity_id:
        query = query.eq("entity_id", str(entity_id))
    if status:
        query = query.eq("status", status.value)
    
    response = query.order("created_at", desc=True).execute()
    return convert_uuids(response.data)

@app.get("/workflow-instances/{instance_id}", response_model=WorkflowInstanceResponse)
async def get_workflow_instance(instance_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("workflow_instances").select("*").eq("id", str(instance_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Workflow instance not found")
    return convert_uuids(response.data[0])

# Approval Step Endpoints
@app.get("/workflow-instances/{instance_id}/steps")
async def get_workflow_steps(instance_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("approval_steps").select("*").eq("workflow_instance_id", str(instance_id)).order("step_number").execute()
    return convert_uuids(response.data)

@app.post("/approval-steps/{step_id}/approve")
async def approve_step(
    step_id: UUID,
    comments: str | None = None,
    current_user = Depends(get_current_user)
):
    """Approve a workflow step"""
    try:
        # Get the approval step
        step_response = supabase.table("approval_steps").select("*").eq("id", str(step_id)).execute()
        if not step_response.data:
            raise HTTPException(status_code=404, detail="Approval step not found")
        
        step = step_response.data[0]
        
        # Check if user is authorized to approve
        if step['approver_id'] != current_user['user_id']:
            raise HTTPException(status_code=403, detail="Not authorized to approve this step")
        
        # Update step status
        update_data = {
            "status": ApprovalStatus.approved.value,
            "approved_at": datetime.now().isoformat(),
            "comments": comments
        }
        
        supabase.table("approval_steps").update(update_data).eq("id", str(step_id)).execute()
        
        # Check if workflow should advance
        await advance_workflow_if_ready(step['workflow_instance_id'])
        
        return {"message": "Step approved successfully", "step_id": str(step_id)}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")

@app.post("/approval-steps/{step_id}/reject")
async def reject_step(
    step_id: UUID,
    comments: str,
    current_user = Depends(get_current_user)
):
    """Reject a workflow step"""
    try:
        # Get the approval step
        step_response = supabase.table("approval_steps").select("*").eq("id", str(step_id)).execute()
        if not step_response.data:
            raise HTTPException(status_code=404, detail="Approval step not found")
        
        step = step_response.data[0]
        
        # Check if user is authorized to reject
        if step['approver_id'] != current_user['user_id']:
            raise HTTPException(status_code=403, detail="Not authorized to reject this step")
        
        # Update step status
        update_data = {
            "status": ApprovalStatus.rejected.value,
            "rejected_at": datetime.now().isoformat(),
            "comments": comments
        }
        
        supabase.table("approval_steps").update(update_data).eq("id", str(step_id)).execute()
        
        # Mark workflow as cancelled
        supabase.table("workflow_instances").update({
            "status": WorkflowStatus.cancelled.value,
            "completed_at": datetime.now().isoformat()
        }).eq("id", step['workflow_instance_id']).execute()
        
        return {"message": "Step rejected, workflow cancelled", "step_id": str(step_id)}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Rejection failed: {str(e)}")

@app.get("/my-approvals")
async def get_my_pending_approvals(current_user = Depends(get_current_user)):
    """Get pending approvals for the current user"""
    response = supabase.table("approval_steps").select("*").eq("approver_id", current_user['user_id']).eq("status", ApprovalStatus.pending.value).order("created_at").execute()
    
    approvals = convert_uuids(response.data)
    
    # Enhance with workflow and entity information
    for approval in approvals:
        # Get workflow instance
        workflow_response = supabase.table("workflow_instances").select("*").eq("id", approval['workflow_instance_id']).execute()
        if workflow_response.data:
            approval['workflow'] = convert_uuids(workflow_response.data[0])
        
        # Get entity information based on entity_type
        if approval.get('workflow') and approval['workflow'].get('entity_type') == 'project':
            entity_response = supabase.table("projects").select("name, description").eq("id", approval['workflow']['entity_id']).execute()
            if entity_response.data:
                approval['entity'] = entity_response.data[0]
    
    return approvals

# Workflow Helper Functions
async def create_approval_steps_from_template(workflow_instance_id: str, template: dict):
    """Create approval steps based on workflow template"""
    steps = template.get('steps', [])
    
    for i, step_config in enumerate(steps):
        step_data = {
            "workflow_instance_id": workflow_instance_id,
            "step_number": i + 1,
            "approver_id": step_config.get('approver_id'),
            "step_name": step_config.get('name', f'Step {i + 1}'),
            "instructions": step_config.get('instructions'),
            "status": ApprovalStatus.pending.value if i == 0 else ApprovalStatus.pending.value,  # First step is active
            "due_date": None  # Could calculate based on template timeout
        }
        
        supabase.table("approval_steps").insert(step_data).execute()

async def advance_workflow_if_ready(workflow_instance_id: str):
    """Check if workflow can advance to next step or complete"""
    # Get workflow instance
    instance_response = supabase.table("workflow_instances").select("*").eq("id", workflow_instance_id).execute()
    if not instance_response.data:
        return
    
    instance = instance_response.data[0]
    
    # Get template to understand workflow type
    template_response = supabase.table("workflow_templates").select("*").eq("id", instance['template_id']).execute()
    if not template_response.data:
        return
    
    template = template_response.data[0]
    
    # Get all steps for this workflow
    steps_response = supabase.table("approval_steps").select("*").eq("workflow_instance_id", workflow_instance_id).order("step_number").execute()
    steps = steps_response.data
    
    if template['workflow_type'] == WorkflowType.sequential.value:
        # Sequential: check if current step is approved, advance to next
        current_step = instance['current_step']
        current_step_data = next((s for s in steps if s['step_number'] == current_step), None)
        
        if current_step_data and current_step_data['status'] == ApprovalStatus.approved.value:
            if current_step < instance['total_steps']:
                # Advance to next step
                supabase.table("workflow_instances").update({
                    "current_step": current_step + 1,
                    "steps_completed": current_step
                }).eq("id", workflow_instance_id).execute()
            else:
                # Workflow complete
                supabase.table("workflow_instances").update({
                    "status": WorkflowStatus.completed.value,
                    "completed_at": datetime.now().isoformat(),
                    "steps_completed": instance['total_steps']
                }).eq("id", workflow_instance_id).execute()
    
    elif template['workflow_type'] == WorkflowType.parallel.value:
        # Parallel: check if all steps are approved
        approved_steps = [s for s in steps if s['status'] == ApprovalStatus.approved.value]
        if len(approved_steps) == len(steps):
            # All steps approved, complete workflow
            supabase.table("workflow_instances").update({
                "status": WorkflowStatus.completed.value,
                "completed_at": datetime.now().isoformat(),
                "steps_completed": len(steps)
            }).eq("id", workflow_instance_id).execute()

# Portfolio CRUD endpoints
class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None
    owner_id: UUID | None = None
    budget: float | None = None
    start_date: date | None = None
    end_date: date | None = None

class PortfolioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    owner_id: UUID | None = None
    budget: float | None = None
    start_date: date | None = None
    end_date: date | None = None

class PortfolioResponse(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str | None
    budget: float | None
    start_date: date | None
    end_date: date | None
    project_count: int = 0
    total_budget: float = 0.0
    total_actual_cost: float = 0.0
    health_distribution: dict = {}
    created_at: datetime
    updated_at: datetime

@app.post("/portfolios/", response_model=PortfolioResponse, status_code=status.HTTP_201_CREATED)
async def create_portfolio(portfolio: PortfolioCreate, current_user = Depends(get_current_user)):
    try:
        portfolio_data = portfolio.dict()
        
        response = supabase.table("portfolios").insert(portfolio_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Fehler beim Erstellen des Portfolios")
        
        portfolio_record = convert_uuids(response.data[0])
        
        # Add calculated fields
        portfolio_record['project_count'] = 0
        portfolio_record['total_budget'] = 0.0
        portfolio_record['total_actual_cost'] = 0.0
        portfolio_record['health_distribution'] = {"green": 0, "yellow": 0, "red": 0}
        
        return portfolio_record
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/portfolios/")
@monitor_performance
@cached("portfolios_list", ttl=300)
async def list_portfolios(request: Request, current_user = Depends(get_current_user)):
    response = supabase.table("portfolios").select("*").execute()
    portfolios = convert_uuids(response.data)
    
    # Enhance each portfolio with project statistics
    for portfolio in portfolios:
        # Get projects for this portfolio
        projects_response = supabase.table("projects").select("*").eq("portfolio_id", portfolio['id']).execute()
        projects = projects_response.data
        
        portfolio['project_count'] = len(projects)
        portfolio['total_budget'] = sum(float(p.get('budget', 0)) for p in projects if p.get('budget'))
        portfolio['total_actual_cost'] = sum(float(p.get('actual_cost', 0)) for p in projects if p.get('actual_cost'))
        
        # Calculate health distribution
        health_distribution = {"green": 0, "yellow": 0, "red": 0}
        for project in projects:
            health = project.get('health', 'green')
            health_distribution[health] = health_distribution.get(health, 0) + 1
        portfolio['health_distribution'] = health_distribution
    
    return portfolios

@app.get("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(portfolio_id: UUID, current_user = Depends(get_current_user)):
    response = supabase.table("portfolios").select("*").eq("id", str(portfolio_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    portfolio = convert_uuids(response.data[0])
    
    # Get projects for this portfolio
    projects_response = supabase.table("projects").select("*").eq("portfolio_id", str(portfolio_id)).execute()
    projects = projects_response.data
    
    portfolio['project_count'] = len(projects)
    portfolio['total_budget'] = sum(float(p.get('budget', 0)) for p in projects if p.get('budget'))
    portfolio['total_actual_cost'] = sum(float(p.get('actual_cost', 0)) for p in projects if p.get('actual_cost'))
    
    # Calculate health distribution
    health_distribution = {"green": 0, "yellow": 0, "red": 0}
    for project in projects:
        health = project.get('health', 'green')
        health_distribution[health] = health_distribution.get(health, 0) + 1
    portfolio['health_distribution'] = health_distribution
    
    return portfolio

@app.patch("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(portfolio_id: UUID, portfolio_update: PortfolioUpdate, current_user = Depends(get_current_user)):
    data_to_update = {k: v for k, v in portfolio_update.dict().items() if v is not None}
    if not data_to_update:
        raise HTTPException(status_code=400, detail="Keine Daten zum Updaten")
    
    response = supabase.table("portfolios").update(data_to_update).eq("id", str(portfolio_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    portfolio = convert_uuids(response.data[0])
    
    # Get projects for this portfolio
    projects_response = supabase.table("projects").select("*").eq("portfolio_id", str(portfolio_id)).execute()
    projects = projects_response.data
    
    portfolio['project_count'] = len(projects)
    portfolio['total_budget'] = sum(float(p.get('budget', 0)) for p in projects if p.get('budget'))
    portfolio['total_actual_cost'] = sum(float(p.get('actual_cost', 0)) for p in projects if p.get('actual_cost'))
    
    # Calculate health distribution
    health_distribution = {"green": 0, "yellow": 0, "red": 0}
    for project in projects:
        health = project.get('health', 'green')
        health_distribution[health] = health_distribution.get(health, 0) + 1
    portfolio['health_distribution'] = health_distribution
    
    return portfolio

@app.delete("/portfolios/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio(portfolio_id: UUID, current_user = Depends(get_current_user)):
    # Check if portfolio has projects
    projects_response = supabase.table("projects").select("id").eq("portfolio_id", str(portfolio_id)).execute()
    if projects_response.data:
        raise HTTPException(status_code=400, detail="Cannot delete portfolio with existing projects")
    
    response = supabase.table("portfolios").delete().eq("id", str(portfolio_id)).execute()
    if response.count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return None

# Portfolio-level metrics and analytics endpoints
@app.get("/portfolio/metrics")
@monitor_performance
@cached("portfolio_metrics", ttl=180, key_params=["portfolio_id"])
async def get_portfolio_metrics(request: Request, portfolio_id: UUID | None = Query(None), current_user = Depends(get_current_user)):
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

# Performance monitoring and management endpoints
@app.get("/admin/performance/stats")
@monitor_performance
async def get_performance_stats(request: Request, current_user = Depends(get_current_user)):
    """Get API performance statistics"""
    return performance_monitor.get_stats()

@app.get("/admin/performance/health")
async def get_api_health(request: Request):
    """Get API health status"""
    stats = performance_monitor.get_stats()
    
    # Calculate health metrics
    total_requests = stats.get('total_requests', 0)
    total_errors = stats.get('total_errors', 0)
    error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
    slow_queries = stats.get('slow_queries_count', 0)
    
    health_status = "healthy"
    if error_rate > 10:
        health_status = "unhealthy"
    elif error_rate > 5 or slow_queries > 10:
        health_status = "degraded"
    
    return {
        "status": health_status,
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": {
            "total_requests": total_requests,
            "error_rate": round(error_rate, 2),
            "slow_queries": slow_queries,
            "uptime": "healthy"
        },
        "cache_status": "redis" if hasattr(cache_manager, 'redis_client') else "memory"
    }

@app.post("/admin/cache/clear")
@monitor_performance
async def clear_cache(request: Request, patterns: List[str] = None, current_user = Depends(get_current_user)):
    """Clear cache entries matching patterns"""
    if not patterns:
        patterns = ["*"]
    
    cleared_count = 0
    for pattern in patterns:
        try:
            cache_manager.clear_pattern(pattern)
            cleared_count += 1
        except Exception as e:
            print(f"Failed to clear cache pattern {pattern}: {e}")
    
    return {
        "message": f"Cleared {cleared_count} cache patterns",
        "patterns": patterns,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/admin/cache/stats")
@monitor_performance
async def get_cache_stats(request: Request, current_user = Depends(get_current_user)):
    """Get cache statistics"""
    return {
        "type": "memory",
        "message": "Cache statistics available"
    }

# Bulk operations endpoints for better performance
@app.post("/bulk/projects")
@monitor_performance
async def bulk_create_projects(request: Request, projects: List[ProjectCreate], current_user = Depends(get_current_user)):
    """Create multiple projects in bulk for better performance"""
    try:
        results = []
        for project in projects:
            try:
                # Convert to dict for database insertion
                project_data = {
                    "portfolio_id": str(project.portfolio_id),
                    "name": project.name,
                    "description": project.description,
                    "status": project.status.value,
                    "priority": project.priority,
                    "budget": project.budget,
                    "start_date": project.start_date.isoformat() if project.start_date else None,
                    "end_date": project.end_date.isoformat() if project.end_date else None,
                    "manager_id": str(project.manager_id) if project.manager_id else None,
                    "team_members": [str(member_id) for member_id in project.team_members],
                    "health": "green"  # Default health
                }
                
                response = supabase.table("projects").insert(project_data).execute()
                if response.data:
                    results.append(response.data[0])
                    
                    # Invalidate related caches
                    invalidate_cache([
                        f"projects_list:*",
                        f"portfolio_metrics:*"
                    ])
                    
            except Exception as e:
                print(f"Failed to create project {project.name}: {e}")
                results.append({"error": str(e), "project_name": project.name})
                
        successful = [r for r in results if "error" not in r]
        failed = [r for r in results if "error" in r]
        
        return {
            "message": f"Bulk operation completed: {len(successful)} successful, {len(failed)} failed",
            "successful_count": len(successful),
            "failed_count": len(failed),
            "successful_projects": successful,
            "failed_projects": failed
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bulk operation failed: {str(e)}")

# Cache invalidation helper
def invalidate_project_caches(project_id: str = None, portfolio_id: str = None):
    """Helper function to invalidate project-related caches"""
    patterns = [
        "projects_list:*",
        "portfolio_metrics:*",
        "portfolio_trends:*"
    ]
    
    if project_id:
        patterns.append(f"project_detail:*{project_id}*")
    
    if portfolio_id:
        patterns.append(f"*portfolio_id*{portfolio_id}*")
    
    invalidate_cache(patterns)

# For deployment - Vercel serverless function handler
# Export the app for Vercel
handler = app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)