"""
Resource management Pydantic models
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID

from .base import BaseResponse

class ResourceCreate(BaseModel):
    name: str
    email: str
    role: str
    capacity: int = 40  # hours per week
    availability: int = 100  # percentage
    hourly_rate: Optional[float] = None
    skills: List[str] = []
    location: Optional[str] = None

class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    capacity: Optional[int] = None
    availability: Optional[int] = None
    hourly_rate: Optional[float] = None
    skills: Optional[List[str]] = None
    location: Optional[str] = None

class ResourceResponse(BaseResponse):
    name: str
    email: str
    role: str
    capacity: int
    availability: int
    hourly_rate: Optional[float]
    skills: List[str]
    location: Optional[str]
    current_projects: List[str] = []
    utilization_percentage: Optional[float] = None
    available_hours: Optional[float] = None
    allocated_hours: Optional[float] = None
    capacity_hours: Optional[float] = None
    availability_status: Optional[str] = None
    can_take_more_work: Optional[bool] = None

class ResourceSearchRequest(BaseModel):
    skills: Optional[List[str]] = None
    min_capacity: Optional[int] = None
    max_capacity: Optional[int] = None
    min_availability: Optional[int] = None
    role: Optional[str] = None
    location: Optional[str] = None

class ResourceAllocationSuggestion(BaseModel):
    resource_id: str
    resource_name: str
    match_score: float
    availability_hours: float
    skills_match: List[str]
    recommendation_reason: str

class ResourceOptimizationRequest(BaseModel):
    portfolio_id: Optional[str] = None
    project_id: Optional[str] = None