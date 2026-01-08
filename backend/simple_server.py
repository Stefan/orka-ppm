#!/usr/bin/env python3
"""
Simplified FastAPI server for development
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os

# Create FastAPI application
app = FastAPI(
    title="ORKA-PPM API",
    description="Portfolio Project Management API",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orka-ppm.vercel.app",           # Production frontend
        "https://ppm-saas.vercel.app",           # Alternative URL
        "https://ppm-saas-git-main.vercel.app",  # Git branch deployments
        "https://ppm-saas-*.vercel.app",         # Preview deployments
        "https://*.vercel.app",                  # All Vercel deployments
        "http://localhost:3000",                 # Local development
        "http://127.0.0.1:3000",
        "https://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Basic endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ORKA-PPM API Server",
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

# Mock dashboard data
@app.get("/optimized/dashboard/quick-stats")
async def get_quick_stats():
    """Mock dashboard quick stats"""
    return {
        "quick_stats": {
            "total_projects": 12,
            "active_projects": 8,
            "health_distribution": {
                "green": 6,
                "yellow": 4,
                "red": 2
            },
            "critical_alerts": 2,
            "at_risk_projects": 4
        },
        "kpis": {
            "project_success_rate": 85,
            "budget_performance": 92,
            "timeline_performance": 78,
            "average_health_score": 2.1,
            "resource_efficiency": 88,
            "active_projects_ratio": 67
        }
    }

@app.get("/optimized/dashboard/projects-summary")
async def get_projects_summary(limit: int = 5):
    """Mock dashboard projects summary"""
    projects = [
        {
            "id": "1",
            "name": "Office Complex Phase 1",
            "status": "active",
            "health": "green",
            "budget": 150000,
            "actual": 145000,
            "variance": -5000,
            "variance_percentage": -3.3,
            "created_at": "2024-01-15T10:00:00Z"
        },
        {
            "id": "2", 
            "name": "Residential Tower A",
            "status": "active",
            "health": "yellow",
            "budget": 200000,
            "actual": 210000,
            "variance": 10000,
            "variance_percentage": 5.0,
            "created_at": "2024-01-20T10:00:00Z"
        },
        {
            "id": "3",
            "name": "Shopping Center Renovation", 
            "status": "active",
            "health": "red",
            "budget": 80000,
            "actual": 95000,
            "variance": 15000,
            "variance_percentage": 18.8,
            "created_at": "2024-02-01T10:00:00Z"
        },
        {
            "id": "4",
            "name": "Parking Garage Construction",
            "status": "active", 
            "health": "green",
            "budget": 120000,
            "actual": 115000,
            "variance": -5000,
            "variance_percentage": -4.2,
            "created_at": "2024-02-10T10:00:00Z"
        },
        {
            "id": "5",
            "name": "Landscape Development",
            "status": "active",
            "health": "yellow", 
            "budget": 60000,
            "actual": 62000,
            "variance": 2000,
            "variance_percentage": 3.3,
            "created_at": "2024-02-15T10:00:00Z"
        }
    ]
    return projects[:limit]

@app.get("/projects")
async def get_projects():
    """Mock projects endpoint"""
    return [
        {
            "id": "1",
            "name": "Office Complex Phase 1",
            "status": "active",
            "health": "green",
            "budget": 150000,
            "created_at": "2024-01-15T10:00:00Z"
        },
        {
            "id": "2", 
            "name": "Residential Tower A",
            "status": "active",
            "health": "yellow",
            "budget": 200000,
            "created_at": "2024-01-20T10:00:00Z"
        },
        {
            "id": "3",
            "name": "Shopping Center Renovation", 
            "status": "active",
            "health": "red",
            "budget": 80000,
            "created_at": "2024-02-01T10:00:00Z"
        }
    ]

@app.get("/projects/{project_id}/scenarios")
async def get_project_scenarios(project_id: str):
    """Mock project scenarios endpoint"""
    return {
        "scenarios": [
            {
                "id": "scenario-1",
                "project_id": project_id,
                "name": "Accelerated Timeline",
                "description": "Complete project 2 weeks earlier by adding resources",
                "base_scenario_id": None,
                "parameter_changes": {
                    "end_date": "2024-06-15",
                    "resource_allocations": {
                        "developers": 8,
                        "designers": 3
                    }
                },
                "timeline_impact": {
                    "original_duration": 120,
                    "new_duration": 106,
                    "duration_change": -14,
                    "critical_path_affected": True,
                    "affected_milestones": ["Phase 1 Complete", "Testing Complete"]
                },
                "cost_impact": {
                    "original_cost": 150000,
                    "new_cost": 165000,
                    "cost_change": 15000,
                    "cost_change_percentage": 10.0,
                    "affected_categories": ["Labor", "Equipment"]
                },
                "resource_impact": {
                    "utilization_changes": {
                        "developers": 25.0,
                        "designers": 15.0
                    },
                    "over_allocated_resources": ["developers"],
                    "under_allocated_resources": [],
                    "new_resource_requirements": ["senior_developer"]
                },
                "created_by": "user-1",
                "created_at": "2024-01-08T10:00:00Z",
                "updated_at": "2024-01-08T10:00:00Z",
                "is_active": True,
                "is_baseline": False
            },
            {
                "id": "scenario-2",
                "project_id": project_id,
                "name": "Budget Optimization",
                "description": "Reduce costs by 15% through resource optimization",
                "base_scenario_id": None,
                "parameter_changes": {
                    "budget": 127500,
                    "resource_allocations": {
                        "developers": 5,
                        "designers": 2
                    }
                },
                "timeline_impact": {
                    "original_duration": 120,
                    "new_duration": 135,
                    "duration_change": 15,
                    "critical_path_affected": True,
                    "affected_milestones": ["Phase 2 Complete"]
                },
                "cost_impact": {
                    "original_cost": 150000,
                    "new_cost": 127500,
                    "cost_change": -22500,
                    "cost_change_percentage": -15.0,
                    "affected_categories": ["Labor"]
                },
                "resource_impact": {
                    "utilization_changes": {
                        "developers": -20.0,
                        "designers": -25.0
                    },
                    "over_allocated_resources": [],
                    "under_allocated_resources": ["developers", "designers"],
                    "new_resource_requirements": []
                },
                "created_by": "user-1",
                "created_at": "2024-01-07T14:30:00Z",
                "updated_at": "2024-01-07T14:30:00Z",
                "is_active": True,
                "is_baseline": False
            },
            {
                "id": "scenario-3",
                "project_id": project_id,
                "name": "Risk Mitigation",
                "description": "Add buffer time and resources for high-risk activities",
                "base_scenario_id": None,
                "parameter_changes": {
                    "end_date": "2024-07-15",
                    "budget": 175000,
                    "risk_adjustments": {
                        "technical_complexity": {"probability": 0.3, "impact": 0.4},
                        "resource_availability": {"probability": 0.2, "impact": 0.3}
                    }
                },
                "timeline_impact": {
                    "original_duration": 120,
                    "new_duration": 140,
                    "duration_change": 20,
                    "critical_path_affected": False,
                    "affected_milestones": ["Final Delivery"]
                },
                "cost_impact": {
                    "original_cost": 150000,
                    "new_cost": 175000,
                    "cost_change": 25000,
                    "cost_change_percentage": 16.7,
                    "affected_categories": ["Labor", "Contingency"]
                },
                "resource_impact": {
                    "utilization_changes": {
                        "developers": 10.0,
                        "qa_engineers": 50.0
                    },
                    "over_allocated_resources": [],
                    "under_allocated_resources": [],
                    "new_resource_requirements": ["risk_manager", "qa_engineer"]
                },
                "created_by": "user-1",
                "created_at": "2024-01-06T09:15:00Z",
                "updated_at": "2024-01-06T09:15:00Z",
                "is_active": True,
                "is_baseline": False
            }
        ]
    }

@app.get("/resources/")
async def get_resources():
    """Mock resources endpoint"""
    return [
        {
            "id": "res-1",
            "name": "Alice Johnson",
            "email": "alice.johnson@company.com",
            "role": "Senior Developer",
            "capacity": 40,
            "availability": 85,
            "hourly_rate": 75,
            "skills": ["Python", "React", "PostgreSQL", "AWS"],
            "location": "New York",
            "current_projects": ["proj-1", "proj-2"],
            "utilization_percentage": 85,
            "available_hours": 6,
            "allocated_hours": 34,
            "capacity_hours": 40,
            "availability_status": "available",
            "can_take_more_work": True,
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z"
        },
        {
            "id": "res-2",
            "name": "Bob Smith",
            "email": "bob.smith@company.com",
            "role": "UI/UX Designer",
            "capacity": 40,
            "availability": 95,
            "hourly_rate": 65,
            "skills": ["Figma", "Adobe Creative Suite", "User Research", "Prototyping"],
            "location": "San Francisco",
            "current_projects": ["proj-1"],
            "utilization_percentage": 60,
            "available_hours": 16,
            "allocated_hours": 24,
            "capacity_hours": 40,
            "availability_status": "available",
            "can_take_more_work": True,
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z"
        },
        {
            "id": "res-3",
            "name": "Carol Davis",
            "email": "carol.davis@company.com",
            "role": "Project Manager",
            "capacity": 40,
            "availability": 100,
            "hourly_rate": 80,
            "skills": ["Agile", "Scrum", "Risk Management", "Stakeholder Communication"],
            "location": "Chicago",
            "current_projects": ["proj-2", "proj-3"],
            "utilization_percentage": 110,
            "available_hours": -4,
            "allocated_hours": 44,
            "capacity_hours": 40,
            "availability_status": "overallocated",
            "can_take_more_work": False,
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z"
        },
        {
            "id": "res-4",
            "name": "David Wilson",
            "email": "david.wilson@company.com",
            "role": "DevOps Engineer",
            "capacity": 40,
            "availability": 90,
            "hourly_rate": 85,
            "skills": ["Docker", "Kubernetes", "CI/CD", "Monitoring"],
            "location": "Austin",
            "current_projects": ["proj-1", "proj-3"],
            "utilization_percentage": 75,
            "available_hours": 10,
            "allocated_hours": 30,
            "capacity_hours": 40,
            "availability_status": "available",
            "can_take_more_work": True,
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z"
        },
        {
            "id": "res-5",
            "name": "Eva Martinez",
            "email": "eva.martinez@company.com",
            "role": "QA Engineer",
            "capacity": 40,
            "availability": 80,
            "hourly_rate": 60,
            "skills": ["Test Automation", "Selenium", "API Testing", "Performance Testing"],
            "location": "Remote",
            "current_projects": ["proj-2"],
            "utilization_percentage": 50,
            "available_hours": 20,
            "allocated_hours": 20,
            "capacity_hours": 40,
            "availability_status": "available",
            "can_take_more_work": True,
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z"
        }
    ]

@app.get("/risks/")
async def get_risks():
    """Mock risks endpoint"""
    return [
        {
            "id": "risk-1",
            "project_id": "1",
            "project_name": "Office Complex Phase 1",
            "title": "Technical Complexity Risk",
            "description": "Integration challenges with legacy systems may cause delays",
            "category": "technical",
            "probability": 0.7,
            "impact": 0.8,
            "risk_score": 5.6,
            "status": "mitigating",
            "owner": "Alice Johnson",
            "created_at": "2024-01-05T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z",
            "mitigation_plan": "Conduct thorough system analysis and create integration roadmap",
            "due_date": "2024-02-15T00:00:00Z",
            "tags": ["integration", "legacy", "technical"]
        },
        {
            "id": "risk-2",
            "project_id": "2",
            "project_name": "Residential Tower A",
            "title": "Budget Overrun Risk",
            "description": "Material costs increasing faster than anticipated",
            "category": "financial",
            "probability": 0.6,
            "impact": 0.9,
            "risk_score": 5.4,
            "status": "analyzing",
            "owner": "Bob Smith",
            "created_at": "2024-01-03T10:00:00Z",
            "updated_at": "2024-01-07T10:00:00Z",
            "mitigation_plan": "Lock in material prices with suppliers, explore alternative materials",
            "due_date": "2024-01-20T00:00:00Z",
            "tags": ["budget", "materials", "cost"]
        },
        {
            "id": "risk-3",
            "project_id": "1",
            "project_name": "Office Complex Phase 1",
            "title": "Resource Availability Risk",
            "description": "Key team members may not be available during critical phases",
            "category": "resource",
            "probability": 0.4,
            "impact": 0.7,
            "risk_score": 2.8,
            "status": "identified",
            "owner": "Carol Davis",
            "created_at": "2024-01-02T10:00:00Z",
            "updated_at": "2024-01-06T10:00:00Z",
            "mitigation_plan": "Cross-train team members and identify backup resources",
            "due_date": "2024-02-01T00:00:00Z",
            "tags": ["resources", "team", "availability"]
        },
        {
            "id": "risk-4",
            "project_id": "3",
            "project_name": "Shopping Center Renovation",
            "title": "Schedule Delay Risk",
            "description": "Weather conditions may impact construction timeline",
            "category": "schedule",
            "probability": 0.5,
            "impact": 0.6,
            "risk_score": 3.0,
            "status": "mitigating",
            "owner": "David Wilson",
            "created_at": "2024-01-01T10:00:00Z",
            "updated_at": "2024-01-08T10:00:00Z",
            "mitigation_plan": "Build weather contingency into schedule, prepare indoor work alternatives",
            "due_date": "2024-03-01T00:00:00Z",
            "tags": ["schedule", "weather", "construction"]
        },
        {
            "id": "risk-5",
            "project_id": "2",
            "project_name": "Residential Tower A",
            "title": "Regulatory Compliance Risk",
            "description": "New building codes may require design changes",
            "category": "external",
            "probability": 0.3,
            "impact": 0.8,
            "risk_score": 2.4,
            "status": "closed",
            "owner": "Eva Martinez",
            "created_at": "2023-12-15T10:00:00Z",
            "updated_at": "2024-01-05T10:00:00Z",
            "mitigation_plan": "Regular consultation with regulatory authorities, design flexibility",
            "due_date": "2024-01-15T00:00:00Z",
            "tags": ["regulatory", "compliance", "design"]
        }
    ]

@app.get("/portfolios/metrics")
async def get_portfolio_metrics():
    """Mock portfolio metrics"""
    return {
        "project_success_rate": 85,
        "budget_performance": 92,
        "timeline_performance": 78,
        "average_health_score": 2.1,
        "resource_efficiency": 88,
        "active_projects_ratio": 67
    }

# Variance endpoints
@app.get("/variance/kpis")
async def get_variance_kpis():
    """Mock variance KPIs"""
    return {
        "total_budget": 1250000,
        "total_actual": 1180000,
        "total_variance": -70000,
        "variance_percentage": -5.6,
        "projects_over_budget": 3,
        "projects_under_budget": 5,
        "projects_on_budget": 4,
        "average_variance_percentage": -2.3,
        "largest_positive_variance": 25000,
        "largest_negative_variance": -45000,
        "variance_trend": "improving",
        "last_updated": datetime.now().isoformat()
    }

@app.get("/variance/alerts")
async def get_variance_alerts():
    """Mock variance alerts"""
    return {
        "alerts": [
            {
                "id": "alert-1",
                "project_id": "proj-1",
                "project_name": "Office Complex Phase 1",
                "alert_type": "budget_overrun",
                "severity": "high",
                "variance_amount": -45000,
                "variance_percentage": -15.2,
                "threshold_exceeded": "budget_variance_10_percent",
                "created_at": "2024-01-08T10:00:00Z",
                "status": "active"
            },
            {
                "id": "alert-2", 
                "project_id": "proj-3",
                "project_name": "Shopping Center Renovation",
                "alert_type": "budget_overrun",
                "severity": "medium",
                "variance_amount": -12000,
                "variance_percentage": -8.5,
                "threshold_exceeded": "budget_variance_5_percent",
                "created_at": "2024-01-08T09:30:00Z",
                "status": "active"
            }
        ],
        "total_alerts": 2,
        "high_severity": 1,
        "medium_severity": 1,
        "low_severity": 0
    }

@app.get("/variance/trends")
async def get_variance_trends():
    """Mock variance trends"""
    return {
        "monthly_trends": [
            {
                "month": "2024-01",
                "total_variance": -25000,
                "variance_percentage": -2.1,
                "projects_count": 8
            },
            {
                "month": "2024-02", 
                "total_variance": -35000,
                "variance_percentage": -3.2,
                "projects_count": 10
            },
            {
                "month": "2024-03",
                "total_variance": -15000,
                "variance_percentage": -1.8,
                "projects_count": 12
            }
        ],
        "project_trends": [
            {
                "project_id": "proj-1",
                "project_name": "Office Complex Phase 1",
                "variance_history": [
                    {"date": "2024-01-01", "variance": -5000},
                    {"date": "2024-02-01", "variance": -15000},
                    {"date": "2024-03-01", "variance": -25000}
                ]
            }
        ]
    }

# Financial tracking endpoints
@app.get("/projects/{project_id}/budget-variance")
async def get_project_budget_variance(project_id: str, currency: str = "USD"):
    """Mock project budget variance"""
    return {
        "project_id": project_id,
        "total_planned": 150000,
        "total_actual": 165000,
        "variance_amount": 15000,
        "variance_percentage": 10.0,
        "currency": currency,
        "categories": [
            {
                "category": "Development",
                "planned": 80000,
                "actual": 90000,
                "variance": 10000,
                "variance_percentage": 12.5
            },
            {
                "category": "Infrastructure", 
                "planned": 40000,
                "actual": 45000,
                "variance": 5000,
                "variance_percentage": 12.5
            },
            {
                "category": "Marketing",
                "planned": 30000,
                "actual": 30000,
                "variance": 0,
                "variance_percentage": 0.0
            }
        ],
        "status": "over_budget"
    }

@app.get("/financial-tracking/budget-alerts")
async def get_financial_alerts(threshold_percentage: float = 80):
    """Mock financial alerts"""
    return {
        "alerts": [
            {
                "project_id": "1",
                "project_name": "Office Complex Phase 1",
                "budget": 150000,
                "actual_cost": 165000,
                "utilization_percentage": 110.0,
                "variance_amount": 15000,
                "alert_level": "critical",
                "message": "Project has exceeded budget by 10%"
            },
            {
                "project_id": "2",
                "project_name": "Residential Tower A", 
                "budget": 200000,
                "actual_cost": 180000,
                "utilization_percentage": 90.0,
                "variance_amount": -20000,
                "alert_level": "warning",
                "message": "Project is approaching budget threshold"
            }
        ]
    }

@app.get("/financial-tracking/comprehensive-report")
async def get_comprehensive_financial_report(currency: str = "USD", include_trends: bool = True):
    """Mock comprehensive financial report"""
    return {
        "report_metadata": {
            "generated_at": datetime.now().isoformat(),
            "currency": currency,
            "projects_included": 3,
            "includes_trends": include_trends
        },
        "summary": {
            "total_budget": 530000,
            "total_actual": 590000,
            "total_variance": 60000,
            "variance_percentage": 11.3,
            "currency": currency
        },
        "project_analysis": [
            {
                "project_id": "1",
                "project_name": "Office Complex Phase 1",
                "budget": 150000,
                "actual_cost": 165000,
                "variance_amount": 15000,
                "variance_percentage": 10.0,
                "utilization_percentage": 110.0,
                "status": "over_budget",
                "health": "yellow"
            },
            {
                "project_id": "2",
                "project_name": "Residential Tower A",
                "budget": 200000,
                "actual_cost": 220000,
                "variance_amount": 20000,
                "variance_percentage": 10.0,
                "utilization_percentage": 110.0,
                "status": "over_budget", 
                "health": "red"
            },
            {
                "project_id": "3",
                "project_name": "Shopping Center Renovation",
                "budget": 180000,
                "actual_cost": 205000,
                "variance_amount": 25000,
                "variance_percentage": 13.9,
                "utilization_percentage": 113.9,
                "status": "over_budget",
                "health": "red"
            }
        ],
        "category_spending": [
            {
                "category": "Development",
                "total_spending": 315000,
                "transaction_count": 45,
                "average_per_transaction": 7000
            },
            {
                "category": "Infrastructure",
                "total_spending": 180000,
                "transaction_count": 20,
                "average_per_transaction": 9000
            },
            {
                "category": "Marketing",
                "total_spending": 95000,
                "transaction_count": 15,
                "average_per_transaction": 6333
            }
        ],
        "trend_projections": [
            {
                "month": "2024-02",
                "projected_spending": 200000,
                "projected_variance": 15000,
                "confidence": 0.85
            },
            {
                "month": "2024-03",
                "projected_spending": 220000,
                "projected_variance": 20000,
                "confidence": 0.80
            }
        ],
        "risk_indicators": {
            "projects_over_budget": 3,
            "projects_at_risk": 1,
            "critical_projects": 1,
            "average_utilization": 111.3
        }
    }

# CSV Import endpoints
@app.get("/csv-import/variances")
async def get_csv_variances():
    """Mock CSV import variances"""
    return {
        "variances": [
            {
                "id": "var-1",
                "project_id": "proj-1",
                "project_name": "Office Complex Phase 1",
                "budget": 300000,
                "actual": 345000,
                "total_commitment": 300000,
                "total_actual": 345000,
                "variance": -45000,
                "variance_percentage": -15.0,
                "category": "construction",
                "date": "2024-01-08",
                "status": "over"
            },
            {
                "id": "var-2",
                "project_id": "proj-2", 
                "project_name": "Residential Tower A",
                "budget": 250000,
                "actual": 235000,
                "total_commitment": 250000,
                "total_actual": 235000,
                "variance": 15000,
                "variance_percentage": 6.0,
                "category": "materials",
                "date": "2024-01-08",
                "status": "under"
            },
            {
                "id": "var-3",
                "project_id": "proj-3",
                "project_name": "Shopping Center Renovation",
                "budget": 150000,
                "actual": 162000,
                "total_commitment": 150000,
                "total_actual": 162000,
                "variance": -12000,
                "variance_percentage": -8.0,
                "category": "labor",
                "date": "2024-01-08", 
                "status": "over"
            }
        ],
        "summary": {
            "total_budget": 700000,
            "total_actual": 742000,
            "total_variance": -42000,
            "variance_percentage": -6.0,
            "projects_over_budget": 2,
            "projects_under_budget": 1,
            "projects_on_budget": 0
        },
        "last_updated": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8002))
    print(f"🚀 Starting ORKA-PPM API server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)