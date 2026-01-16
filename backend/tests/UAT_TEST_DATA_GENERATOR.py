"""
User Acceptance Testing (UAT) Test Data Generator

Task 14.3: User acceptance testing preparation
- Create test data sets for demonstration
- Prepare user training materials
- Document known limitations and workarounds
- Requirements: 10.1, 10.2, 10.3, 10.4

This script generates comprehensive test data for UAT including:
1. Sample projects with realistic data
2. Monte Carlo simulation scenarios
3. What-if scenarios for analysis
4. Change requests with approval workflows
5. PO breakdown structures
6. Report templates and examples
"""

import json
import random
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from typing import Dict, List, Any


class UATTestDataGenerator:
    """Generate comprehensive test data for user acceptance testing"""
    
    def __init__(self):
        self.test_data = {
            "projects": [],
            "shareable_urls": [],
            "simulations": [],
            "scenarios": [],
            "change_requests": [],
            "po_breakdowns": [],
            "report_templates": []
        }
    
    def generate_all_test_data(self) -> Dict[str, Any]:
        """Generate complete test data set"""
        print("🔄 Generating UAT test data...")
        
        # Generate test projects
        self.generate_test_projects()
        
        # Generate shareable URLs
        self.generate_shareable_urls()
        
        # Generate Monte Carlo simulations
        self.generate_monte_carlo_simulations()
        
        # Generate what-if scenarios
        self.generate_what_if_scenarios()
        
        # Generate change requests
        self.generate_change_requests()
        
        # Generate PO breakdowns
        self.generate_po_breakdowns()
        
        # Generate report templates
        self.generate_report_templates()
        
        print("✅ UAT test data generation complete!")
        return self.test_data

    
    def generate_test_projects(self):
        """Generate sample projects for testing"""
        projects = [
            {
                "id": str(uuid4()),
                "name": "Construction Project Alpha - Office Building",
                "description": "New 5-story office building construction in downtown area",
                "status": "active",
                "budget": 5000000.00,
                "spent_to_date": 3250000.00,
                "start_date": (datetime.now() - timedelta(days=180)).date().isoformat(),
                "end_date": (datetime.now() + timedelta(days=180)).date().isoformat(),
                "completion_percentage": 65,
                "project_manager": "John Smith",
                "risks": [
                    {"title": "Weather delays", "probability": 0.4, "impact": 0.6},
                    {"title": "Material shortages", "probability": 0.3, "impact": 0.7},
                    {"title": "Labor availability", "probability": 0.2, "impact": 0.5}
                ]
            },
            {
                "id": str(uuid4()),
                "name": "Infrastructure Upgrade - Highway Extension",
                "description": "Highway extension project with 10km new roadway",
                "status": "active",
                "budget": 15000000.00,
                "spent_to_date": 8500000.00,
                "start_date": (datetime.now() - timedelta(days=270)).date().isoformat(),
                "end_date": (datetime.now() + timedelta(days=450)).date().isoformat(),
                "completion_percentage": 45,
                "project_manager": "Sarah Johnson",
                "risks": [
                    {"title": "Environmental permits", "probability": 0.5, "impact": 0.8},
                    {"title": "Traffic management", "probability": 0.4, "impact": 0.6},
                    {"title": "Utility relocations", "probability": 0.6, "impact": 0.7}
                ]
            },
            {
                "id": str(uuid4()),
                "name": "Manufacturing Facility - Phase 2 Expansion",
                "description": "Expansion of existing manufacturing facility with new production line",
                "status": "planning",
                "budget": 8000000.00,
                "spent_to_date": 500000.00,
                "start_date": datetime.now().date().isoformat(),
                "end_date": (datetime.now() + timedelta(days=365)).date().isoformat(),
                "completion_percentage": 5,
                "project_manager": "Michael Chen",
                "risks": [
                    {"title": "Equipment delivery delays", "probability": 0.3, "impact": 0.8},
                    {"title": "Integration complexity", "probability": 0.5, "impact": 0.6},
                    {"title": "Regulatory compliance", "probability": 0.2, "impact": 0.9}
                ]
            }
        ]
        
        self.test_data["projects"] = projects
        print(f"✅ Generated {len(projects)} test projects")
    
    def generate_shareable_urls(self):
        """Generate shareable URL examples"""
        if not self.test_data["projects"]:
            return
        
        shareable_urls = []
        for project in self.test_data["projects"][:2]:  # First 2 projects
            shareable_urls.append({
                "id": str(uuid4()),
                "project_id": project["id"],
                "project_name": project["name"],
                "token": f"share_{uuid4().hex[:16]}",
                "permissions": {
                    "can_view_basic_info": True,
                    "can_view_financial": True,
                    "can_view_risks": True,
                    "can_view_resources": False,
                    "can_view_timeline": True
                },
                "expires_at": (datetime.now() + timedelta(days=30)).isoformat(),
                "created_by": "admin@example.com",
                "access_count": random.randint(0, 25),
                "purpose": "External stakeholder review"
            })
        
        self.test_data["shareable_urls"] = shareable_urls
        print(f"✅ Generated {len(shareable_urls)} shareable URLs")
    
    def generate_monte_carlo_simulations(self):
        """Generate Monte Carlo simulation examples"""
        if not self.test_data["projects"]:
            return
        
        simulations = []
        for project in self.test_data["projects"]:
            base_budget = project["budget"]
            
            simulation = {
                "id": str(uuid4()),
                "project_id": project["id"],
                "project_name": project["name"],
                "config": {
                    "iterations": 10000,
                    "confidence_levels": [0.1, 0.5, 0.9]
                },
                "cost_percentiles": {
                    "P10": base_budget * 0.95,
                    "P50": base_budget * 1.05,
                    "P90": base_budget * 1.20
                },
                "schedule_percentiles": {
                    "P10": 350,
                    "P50": 365,
                    "P90": 395
                },
                "statistics": {
                    "mean_cost": base_budget * 1.06,
                    "std_dev_cost": base_budget * 0.08,
                    "mean_schedule": 368,
                    "std_dev_schedule": 15
                },
                "created_at": datetime.now().isoformat(),
                "interpretation": "50% probability of completing within budget, 90% probability of 20% cost overrun"
            }
            
            simulations.append(simulation)
        
        self.test_data["simulations"] = simulations
        print(f"✅ Generated {len(simulations)} Monte Carlo simulations")
    
    def generate_what_if_scenarios(self):
        """Generate what-if scenario examples"""
        if not self.test_data["projects"]:
            return
        
        scenarios = []
        project = self.test_data["projects"][0]  # Use first project
        
        # Scenario 1: Accelerated schedule
        scenarios.append({
            "id": str(uuid4()),
            "project_id": project["id"],
            "project_name": project["name"],
            "name": "Accelerated Schedule - Add Resources",
            "description": "What if we add 5 additional workers to accelerate the schedule by 30 days?",
            "parameter_changes": {
                "additional_resources": 5,
                "resource_cost_increase": 150000,
                "target_schedule_reduction": 30
            },
            "timeline_impact": {
                "days_change": -30,
                "new_completion_date": (datetime.now() + timedelta(days=150)).date().isoformat(),
                "critical_path_affected": True
            },
            "cost_impact": {
                "cost_change": 150000,
                "new_total_cost": project["budget"] + 150000,
                "roi_analysis": {
                    "early_completion_value": 200000,
                    "net_benefit": 50000
                }
            },
            "resource_impact": {
                "utilization_change": 20,
                "new_peak_utilization": 95
            }
        })
        
        # Scenario 2: Reduced scope
        scenarios.append({
            "id": str(uuid4()),
            "project_id": project["id"],
            "project_name": project["name"],
            "name": "Reduced Scope - Phase Approach",
            "description": "What if we reduce scope by 20% and deliver in phases?",
            "parameter_changes": {
                "scope_reduction_percentage": 20,
                "cost_savings": 1000000,
                "phase_approach": True
            },
            "timeline_impact": {
                "days_change": 0,
                "new_completion_date": project["end_date"],
                "critical_path_affected": False
            },
            "cost_impact": {
                "cost_change": -1000000,
                "new_total_cost": project["budget"] - 1000000,
                "savings_percentage": 20
            },
            "resource_impact": {
                "utilization_change": -15,
                "new_peak_utilization": 70
            }
        })
        
        self.test_data["scenarios"] = scenarios
        print(f"✅ Generated {len(scenarios)} what-if scenarios")
    
    def generate_change_requests(self):
        """Generate change request examples"""
        if not self.test_data["projects"]:
            return
        
        change_requests = []
        project = self.test_data["projects"][0]
        
        # Change Request 1: Safety system upgrade
        change_requests.append({
            "id": str(uuid4()),
            "project_id": project["id"],
            "project_name": project["name"],
            "title": "Emergency Safety System Upgrade",
            "description": "Install enhanced emergency safety systems to meet new regulatory requirements",
            "change_type": "safety",
            "priority": "high",
            "status": "approved",
            "estimated_cost_impact": 250000,
            "estimated_schedule_impact_days": 21,
            "actual_cost_impact": 235000,
            "actual_schedule_impact_days": 19,
            "justification": "Required for regulatory compliance by Q2 2024",
            "requested_by": "Safety Officer",
            "requested_date": (datetime.now() - timedelta(days=45)).isoformat(),
            "approved_date": (datetime.now() - timedelta(days=30)).isoformat(),
            "implementation_status": "completed"
        })
        
        # Change Request 2: Design modification
        change_requests.append({
            "id": str(uuid4()),
            "project_id": project["id"],
            "project_name": project["name"],
            "title": "Structural Design Modification",
            "description": "Modify structural design to accommodate additional floor load requirements",
            "change_type": "design",
            "priority": "medium",
            "status": "implementing",
            "estimated_cost_impact": 180000,
            "estimated_schedule_impact_days": 14,
            "justification": "Client requirement change for heavier equipment",
            "requested_by": "Project Manager",
            "requested_date": (datetime.now() - timedelta(days=20)).isoformat(),
            "approved_date": (datetime.now() - timedelta(days=10)).isoformat(),
            "implementation_status": "in_progress"
        })
        
        self.test_data["change_requests"] = change_requests
        print(f"✅ Generated {len(change_requests)} change requests")

    
    def generate_po_breakdowns(self):
        """Generate PO breakdown examples"""
        if not self.test_data["projects"]:
            return
        
        po_breakdowns = []
        project = self.test_data["projects"][0]
        
        # Main PO categories
        categories = [
            {
                "name": "Construction Materials",
                "planned_amount": 2000000,
                "children": [
                    {"name": "Structural Steel", "planned_amount": 800000, "actual_amount": 785000},
                    {"name": "Concrete", "planned_amount": 600000, "actual_amount": 620000},
                    {"name": "Rebar", "planned_amount": 400000, "actual_amount": 395000},
                    {"name": "Other Materials", "planned_amount": 200000, "actual_amount": 180000}
                ]
            },
            {
                "name": "Labor Costs",
                "planned_amount": 1500000,
                "children": [
                    {"name": "Site Supervision", "planned_amount": 400000, "actual_amount": 410000},
                    {"name": "Construction Crew", "planned_amount": 800000, "actual_amount": 790000},
                    {"name": "Specialized Trades", "planned_amount": 300000, "actual_amount": 285000}
                ]
            },
            {
                "name": "Equipment & Machinery",
                "planned_amount": 800000,
                "children": [
                    {"name": "Heavy Equipment Rental", "planned_amount": 500000, "actual_amount": 485000},
                    {"name": "Tools & Small Equipment", "planned_amount": 200000, "actual_amount": 195000},
                    {"name": "Safety Equipment", "planned_amount": 100000, "actual_amount": 105000}
                ]
            }
        ]
        
        for category in categories:
            parent_id = str(uuid4())
            
            # Create parent breakdown
            parent_actual = sum(child.get("actual_amount", 0) for child in category["children"])
            
            po_breakdowns.append({
                "id": parent_id,
                "project_id": project["id"],
                "name": category["name"],
                "sap_po_number": f"PO-2024-{random.randint(1000, 9999)}",
                "hierarchy_level": 0,
                "parent_breakdown_id": None,
                "cost_center": f"CC-{random.randint(100, 999)}",
                "planned_amount": category["planned_amount"],
                "actual_amount": parent_actual,
                "currency": "USD",
                "breakdown_type": "category",
                "variance": parent_actual - category["planned_amount"],
                "variance_percentage": ((parent_actual - category["planned_amount"]) / category["planned_amount"]) * 100
            })
            
            # Create child breakdowns
            for child in category["children"]:
                child_id = str(uuid4())
                variance = child["actual_amount"] - child["planned_amount"]
                
                po_breakdowns.append({
                    "id": child_id,
                    "project_id": project["id"],
                    "name": child["name"],
                    "sap_po_number": f"PO-2024-{random.randint(1000, 9999)}",
                    "hierarchy_level": 1,
                    "parent_breakdown_id": parent_id,
                    "cost_center": f"CC-{random.randint(100, 999)}",
                    "planned_amount": child["planned_amount"],
                    "actual_amount": child["actual_amount"],
                    "currency": "USD",
                    "breakdown_type": "line_item",
                    "variance": variance,
                    "variance_percentage": (variance / child["planned_amount"]) * 100
                })
        
        self.test_data["po_breakdowns"] = po_breakdowns
        print(f"✅ Generated {len(po_breakdowns)} PO breakdown items")
    
    def generate_report_templates(self):
        """Generate report template examples"""
        templates = [
            {
                "id": str(uuid4()),
                "name": "Executive Project Status Report",
                "description": "Monthly executive briefing with KPIs and highlights",
                "template_type": "executive_summary",
                "data_mappings": {
                    "project_name": "{{project.name}}",
                    "completion_percentage": "{{project.completion_percentage}}",
                    "budget_variance": "{{financial.budget_variance}}",
                    "schedule_variance": "{{schedule.variance_days}}",
                    "risk_summary": "{{risks.summary}}"
                },
                "chart_configurations": [
                    {"chart_type": "bar", "data_source": "budget_by_category", "title": "Budget Allocation"},
                    {"chart_type": "line", "data_source": "schedule_progress", "title": "Schedule Progress"},
                    {"chart_type": "pie", "data_source": "risk_distribution", "title": "Risk Distribution"}
                ],
                "version": "1.0",
                "is_active": True
            },
            {
                "id": str(uuid4()),
                "name": "Detailed Project Status Report",
                "description": "Comprehensive project status with detailed metrics",
                "template_type": "detailed_status",
                "data_mappings": {
                    "project_details": "{{project.*}}",
                    "financial_details": "{{financial.*}}",
                    "schedule_details": "{{schedule.*}}",
                    "resource_details": "{{resources.*}}",
                    "risk_details": "{{risks.*}}"
                },
                "chart_configurations": [
                    {"chart_type": "gantt", "data_source": "schedule_timeline", "title": "Project Timeline"},
                    {"chart_type": "waterfall", "data_source": "cost_breakdown", "title": "Cost Breakdown"},
                    {"chart_type": "heatmap", "data_source": "resource_utilization", "title": "Resource Utilization"}
                ],
                "version": "1.0",
                "is_active": True
            },
            {
                "id": str(uuid4()),
                "name": "Risk Assessment Report",
                "description": "Focused risk analysis and mitigation strategies",
                "template_type": "risk_assessment",
                "data_mappings": {
                    "risk_summary": "{{risks.summary}}",
                    "high_priority_risks": "{{risks.high_priority}}",
                    "mitigation_plans": "{{risks.mitigation_plans}}",
                    "monte_carlo_results": "{{simulations.latest}}"
                },
                "chart_configurations": [
                    {"chart_type": "scatter", "data_source": "risk_matrix", "title": "Risk Probability vs Impact"},
                    {"chart_type": "histogram", "data_source": "monte_carlo_distribution", "title": "Cost Distribution"}
                ],
                "version": "1.0",
                "is_active": True
            }
        ]
        
        self.test_data["report_templates"] = templates
        print(f"✅ Generated {len(templates)} report templates")
    
    def save_to_file(self, filename: str = "uat_test_data.json"):
        """Save test data to JSON file"""
        with open(filename, 'w') as f:
            json.dump(self.test_data, f, indent=2, default=str)
        print(f"✅ Test data saved to {filename}")
    
    def print_summary(self):
        """Print summary of generated test data"""
        print("\n" + "="*80)
        print("UAT TEST DATA SUMMARY")
        print("="*80)
        print(f"Projects: {len(self.test_data['projects'])}")
        print(f"Shareable URLs: {len(self.test_data['shareable_urls'])}")
        print(f"Monte Carlo Simulations: {len(self.test_data['simulations'])}")
        print(f"What-If Scenarios: {len(self.test_data['scenarios'])}")
        print(f"Change Requests: {len(self.test_data['change_requests'])}")
        print(f"PO Breakdown Items: {len(self.test_data['po_breakdowns'])}")
        print(f"Report Templates: {len(self.test_data['report_templates'])}")
        print("="*80)


if __name__ == "__main__":
    generator = UATTestDataGenerator()
    test_data = generator.generate_all_test_data()
    generator.save_to_file("uat_test_data.json")
    generator.print_summary()
    
    print("\n✅ UAT test data generation complete!")
    print("📁 Test data saved to: uat_test_data.json")
    print("\n📋 Next steps:")
    print("1. Review the generated test data")
    print("2. Import test data into the system")
    print("3. Conduct user acceptance testing")
    print("4. Gather feedback and iterate")
