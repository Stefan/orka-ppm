"""
Resource calculation utilities
"""

from typing import List, Dict, Any

def calculate_advanced_skill_match_score(required_skills: List[str], resource_skills: List[str]) -> Dict[str, Any]:
    """Calculate advanced skill matching score with detailed breakdown"""
    if not required_skills:
        return {
            'match_score': 1.0,
            'matching_skills': resource_skills,
            'missing_skills': [],
            'skill_coverage': 1.0
        }
    
    if not resource_skills:
        return {
            'match_score': 0.0,
            'matching_skills': [],
            'missing_skills': required_skills,
            'skill_coverage': 0.0
        }
    
    # Normalize skills for comparison (case-insensitive)
    required_normalized = [skill.lower().strip() for skill in required_skills]
    resource_normalized = [skill.lower().strip() for skill in resource_skills]
    
    # Find exact matches
    matching_skills = []
    for req_skill in required_skills:
        if req_skill.lower().strip() in resource_normalized:
            matching_skills.append(req_skill)
    
    # Find missing skills
    missing_skills = [skill for skill in required_skills if skill.lower().strip() not in resource_normalized]
    
    # Calculate match score
    match_score = len(matching_skills) / len(required_skills) if required_skills else 0.0
    skill_coverage = len(matching_skills) / len(required_skills) if required_skills else 1.0
    
    return {
        'match_score': match_score,
        'matching_skills': matching_skills,
        'missing_skills': missing_skills,
        'skill_coverage': skill_coverage
    }

def calculate_enhanced_resource_availability(resource: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate enhanced resource availability with utilization tracking"""
    try:
        capacity = resource.get('capacity', 40)  # Default 40 hours/week
        availability_percentage = resource.get('availability', 100)  # Default 100%
        
        # Calculate capacity hours based on availability percentage
        capacity_hours = capacity * (availability_percentage / 100)
        
        # Get current project allocations (mock data for now)
        current_projects = resource.get('current_projects', [])
        
        # Calculate allocated hours based on project count (simplified)
        # In a real system, this would come from project allocations table
        allocated_hours = len(current_projects) * 10  # Assume 10 hours per project
        
        # Calculate available hours
        available_hours = max(0, capacity_hours - allocated_hours)
        
        # Calculate utilization percentage
        utilization_percentage = (allocated_hours / capacity_hours * 100) if capacity_hours > 0 else 0
        
        # Determine availability status
        if utilization_percentage >= 100:
            availability_status = "fully_allocated"
        elif utilization_percentage >= 80:
            availability_status = "mostly_allocated"
        elif utilization_percentage >= 50:
            availability_status = "partially_allocated"
        else:
            availability_status = "available"
        
        # Determine if can take more work
        can_take_more_work = available_hours > 0 and utilization_percentage < 100
        
        return {
            'utilization_percentage': round(utilization_percentage, 1),
            'available_hours': round(available_hours, 1),
            'allocated_hours': round(allocated_hours, 1),
            'capacity_hours': round(capacity_hours, 1),
            'availability_status': availability_status,
            'can_take_more_work': can_take_more_work
        }
        
    except Exception as e:
        print(f"Error calculating resource availability: {e}")
        return {
            'utilization_percentage': 0.0,
            'available_hours': 0.0,
            'allocated_hours': 0.0,
            'capacity_hours': 0.0,
            'availability_status': 'unknown',
            'can_take_more_work': False
        }