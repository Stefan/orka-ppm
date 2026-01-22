"""
Domain Generators for PPM Property-Based Testing

This module provides custom Hypothesis generators for PPM-specific domain objects
including projects, portfolios, financial records, and user role assignments.

Task: 2.1 Create custom Hypothesis generators for PPM domain objects
**Validates: Requirements 1.5**
"""

from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4

from hypothesis import strategies as st
from hypothesis.strategies import composite


class DomainGenerators:
    """
    Custom Hypothesis generators for PPM domain objects.
    
    Provides realistic data generators for:
    - Projects with budget, timeline, and status information
    - Financial records with currency and exchange rate support
    - User role assignments for RBAC testing
    - Portfolios with project collections
    - Risk records for risk management testing
    - Resource allocations for capacity planning
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    
    # Valid status values for projects
    PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
    
    # Valid health indicators
    HEALTH_INDICATORS = ['green', 'yellow', 'red']
    
    # Valid currencies with realistic exchange rate ranges to USD
    CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']
    
    # Realistic exchange rate ranges to USD (approximate)
    CURRENCY_EXCHANGE_RATES = {
        'USD': (1.0, 1.0),       # Base currency
        'EUR': (0.85, 0.95),     # Euro typically 0.85-0.95 to USD
        'GBP': (0.75, 0.85),     # British Pound typically 0.75-0.85 to USD
        'JPY': (100.0, 150.0),   # Japanese Yen typically 100-150 to USD
        'CHF': (0.85, 0.95),     # Swiss Franc typically 0.85-0.95 to USD
        'CAD': (1.25, 1.40),     # Canadian Dollar typically 1.25-1.40 to USD
        'AUD': (1.40, 1.60),     # Australian Dollar typically 1.40-1.60 to USD
    }
    
    # Valid user roles with hierarchy levels
    USER_ROLES = ['admin', 'portfolio_manager', 'project_manager', 'viewer', 'analyst']
    
    # Role hierarchy for RBAC testing (higher number = more permissions)
    ROLE_HIERARCHY = {
        'admin': 100,
        'portfolio_manager': 80,
        'project_manager': 60,
        'analyst': 40,
        'viewer': 20
    }
    
    # Valid scope types for RBAC
    SCOPE_TYPES = ['project', 'portfolio', 'organization', None]
    
    # Valid priority levels
    PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical', 'emergency']
    
    # Valid risk categories
    RISK_CATEGORIES = ['technical', 'schedule', 'cost', 'resource', 'external', 'regulatory']
    
    # Valid change types
    CHANGE_TYPES = ['scope', 'schedule', 'budget', 'design', 'regulatory', 'resource']
    
    # Realistic project name prefixes for more realistic data
    PROJECT_NAME_PREFIXES = [
        'Project', 'Initiative', 'Program', 'Development', 'Implementation',
        'Migration', 'Upgrade', 'Integration', 'Modernization', 'Transformation'
    ]
    
    # Realistic department/team names
    DEPARTMENTS = [
        'Engineering', 'Marketing', 'Sales', 'Operations', 'Finance',
        'HR', 'IT', 'Product', 'Research', 'Customer Success'
    ]
    
    @staticmethod
    @composite
    def project_data(draw, 
                     min_budget: float = 0,
                     max_budget: float = 10_000_000,
                     include_dates: bool = True,
                     realistic_names: bool = True) -> Dict[str, Any]:
        """
        Generate realistic project data for testing.
        
        Args:
            draw: Hypothesis draw function
            min_budget: Minimum budget value
            max_budget: Maximum budget value
            include_dates: Whether to include date fields
            realistic_names: Whether to generate realistic project names
            
        Returns:
            Dict containing project data with:
            - id: Unique project identifier (UUID)
            - name: Project name (1-100 characters, realistic if enabled)
            - budget: Budget amount (float, non-negative)
            - start_date: Project start date (ISO format)
            - end_date: Project end date (after start_date, ISO format)
            - status: Project status (planning, active, on_hold, completed, cancelled)
            - health: Health indicator (green, yellow, red)
            - description: Optional project description
            - organization_id: Organization UUID
            - created_at: Creation timestamp (ISO format)
            - priority: Project priority level
            - department: Associated department
            
        Constraints:
        - Budget is always non-negative and within specified range
        - End date is always after or equal to start date
        - Project duration is realistic (1 day to 5 years)
        - Name is non-empty and trimmed
        - Health indicator correlates with status (completed projects tend to be green)
            
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Generate project name - either realistic or random
        if realistic_names:
            prefix = draw(st.sampled_from(DomainGenerators.PROJECT_NAME_PREFIXES))
            department = draw(st.sampled_from(DomainGenerators.DEPARTMENTS))
            year = draw(st.integers(min_value=2020, max_value=2030))
            name = f"{prefix} - {department} {year}"
        else:
            name = draw(st.text(
                alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')),
                min_size=1,
                max_size=100
            ).filter(lambda x: x.strip()))
            name = name.strip() if name.strip() else "Project"
        
        # Generate budget with realistic constraints
        budget = draw(st.floats(
            min_value=min_budget,
            max_value=max_budget,
            allow_nan=False,
            allow_infinity=False
        ))
        
        # Generate status
        status = draw(st.sampled_from(DomainGenerators.PROJECT_STATUSES))
        
        # Generate health indicator with realistic correlation to status
        # Completed projects are more likely to be green
        # Cancelled projects are more likely to be red
        if status == 'completed':
            health = draw(st.sampled_from(['green', 'green', 'green', 'yellow']))
        elif status == 'cancelled':
            health = draw(st.sampled_from(['red', 'red', 'yellow']))
        elif status == 'on_hold':
            health = draw(st.sampled_from(['yellow', 'yellow', 'red']))
        else:
            health = draw(st.sampled_from(DomainGenerators.HEALTH_INDICATORS))
        
        # Generate priority
        priority = draw(st.sampled_from(DomainGenerators.PRIORITY_LEVELS))
        
        # Generate department
        department = draw(st.sampled_from(DomainGenerators.DEPARTMENTS))
        
        project = {
            'id': draw(st.uuids()),
            'name': name,
            'budget': round(budget, 2),
            'status': status,
            'health': health,
            'priority': priority,
            'department': department,
            'description': draw(st.text(max_size=500)),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'organization_id': draw(st.uuids())
        }
        
        if include_dates:
            # Generate start date within reasonable range
            start_date = draw(st.dates(
                min_value=date(2020, 1, 1),
                max_value=date(2030, 12, 31)
            ))
            
            # Generate end date after start date with realistic duration
            # Duration based on budget (larger budgets = longer projects)
            if budget < 100_000:
                max_duration = 365  # Up to 1 year for small projects
            elif budget < 1_000_000:
                max_duration = 730  # Up to 2 years for medium projects
            else:
                max_duration = 1825  # Up to 5 years for large projects
            
            days_duration = draw(st.integers(min_value=1, max_value=max_duration))
            end_date = start_date + timedelta(days=days_duration)
            
            project['start_date'] = start_date.isoformat()
            project['end_date'] = end_date.isoformat()
            project['duration_days'] = days_duration
        
        return project
    
    @staticmethod
    @composite
    def financial_record(draw,
                        min_amount: float = 0,
                        max_amount: float = 1_000_000,
                        include_exchange_rate: bool = True,
                        realistic_exchange_rates: bool = True) -> Dict[str, Any]:
        """
        Generate realistic financial record data for testing.
        
        Args:
            draw: Hypothesis draw function
            min_amount: Minimum amount value
            max_amount: Maximum amount value
            include_exchange_rate: Whether to include exchange rate
            realistic_exchange_rates: Whether to use realistic exchange rate ranges
            
        Returns:
            Dict containing financial record with:
            - id: Unique record identifier (UUID)
            - planned_amount: Planned budget amount (non-negative)
            - actual_amount: Actual spent amount (non-negative)
            - currency: Currency code (USD, EUR, GBP, JPY, CHF, CAD, AUD)
            - exchange_rate: Exchange rate to base currency (USD)
            - variance_amount: Calculated variance (actual - planned)
            - variance_percentage: Calculated variance percentage
            - variance_status: Status classification (under_budget, on_budget, over_budget)
            - period_start: Period start date (ISO format)
            - period_end: Period end date (ISO format)
            - created_at: Creation timestamp (ISO format)
            - category: Financial category
            - cost_center: Cost center identifier
            
        Constraints:
        - Amounts are always non-negative
        - Exchange rates are realistic for the currency (if enabled)
        - Variance calculations are mathematically correct
        - Period end is always after or equal to period start
        - Variance status aligns with variance percentage
            
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        # Generate currency first (needed for exchange rate)
        currency = draw(st.sampled_from(DomainGenerators.CURRENCIES))
        
        # Generate planned amount
        planned_amount = draw(st.floats(
            min_value=min_amount,
            max_value=max_amount,
            allow_nan=False,
            allow_infinity=False
        ))
        
        # Generate actual amount (can be over or under planned)
        # Use a distribution that makes realistic variances more common
        variance_factor = draw(st.floats(
            min_value=0.5,  # 50% of planned
            max_value=1.5,  # 150% of planned
            allow_nan=False,
            allow_infinity=False
        ))
        actual_amount = planned_amount * variance_factor
        
        # Ensure actual amount doesn't exceed reasonable bounds
        actual_amount = min(actual_amount, max_amount * 1.5)
        actual_amount = max(actual_amount, 0)
        
        # Calculate variance
        variance_amount = actual_amount - planned_amount
        variance_percentage = (variance_amount / planned_amount * 100) if planned_amount > 0 else 0
        
        # Determine variance status based on percentage
        if variance_percentage < -5:
            variance_status = 'under_budget'
        elif variance_percentage > 5:
            variance_status = 'over_budget'
        else:
            variance_status = 'on_budget'
        
        # Generate period dates
        period_start = draw(st.dates(
            min_value=date(2020, 1, 1),
            max_value=date(2030, 12, 31)
        ))
        period_days = draw(st.integers(min_value=1, max_value=365))
        period_end = period_start + timedelta(days=period_days)
        
        # Financial categories
        categories = ['labor', 'materials', 'equipment', 'services', 'travel', 'overhead', 'contingency']
        
        record = {
            'id': draw(st.uuids()),
            'planned_amount': round(planned_amount, 2),
            'actual_amount': round(actual_amount, 2),
            'currency': currency,
            'variance_amount': round(variance_amount, 2),
            'variance_percentage': round(variance_percentage, 2),
            'variance_status': variance_status,
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat(),
            'category': draw(st.sampled_from(categories)),
            'cost_center': f"CC-{draw(st.integers(min_value=1000, max_value=9999))}",
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        if include_exchange_rate:
            if realistic_exchange_rates and currency in DomainGenerators.CURRENCY_EXCHANGE_RATES:
                # Use realistic exchange rate range for the currency
                rate_range = DomainGenerators.CURRENCY_EXCHANGE_RATES[currency]
                exchange_rate = draw(st.floats(
                    min_value=rate_range[0],
                    max_value=rate_range[1],
                    allow_nan=False,
                    allow_infinity=False
                ))
            else:
                # Generate generic exchange rate (0.1 to 10.0)
                exchange_rate = draw(st.floats(
                    min_value=0.1,
                    max_value=10.0,
                    allow_nan=False,
                    allow_infinity=False
                ))
            
            record['exchange_rate'] = round(exchange_rate, 6)
            
            # Calculate amount in base currency (USD)
            if currency == 'USD':
                record['amount_usd'] = round(actual_amount, 2)
            else:
                record['amount_usd'] = round(actual_amount / exchange_rate, 2)
        
        return record
    
    @staticmethod
    @composite
    def user_role_assignment(draw,
                            include_scope: bool = True,
                            include_permissions: bool = True) -> Dict[str, Any]:
        """
        Generate user role assignment data for RBAC testing.
        
        Args:
            draw: Hypothesis draw function
            include_scope: Whether to include scope information
            include_permissions: Whether to include derived permissions
            
        Returns:
            Dict containing user role assignment with:
            - id: Unique assignment identifier (UUID)
            - user_id: UUID of the user
            - role: User role (admin, portfolio_manager, project_manager, viewer, analyst)
            - role_level: Numeric role hierarchy level (higher = more permissions)
            - scope_type: Type of scope (project, portfolio, organization, None)
            - scope_id: UUID of the scoped entity (if scope_type is set)
            - assigned_at: Assignment timestamp (ISO format)
            - assigned_by: UUID of the assigning user
            - is_active: Whether the assignment is currently active
            - expires_at: Optional expiration timestamp
            - permissions: List of derived permissions (if enabled)
            
        Constraints:
        - scope_id is only present when scope_type is not None
        - Role hierarchy is consistent (admin > portfolio_manager > project_manager > analyst > viewer)
        - Permissions are derived from role and scope
        - Active assignments have valid date ranges
            
        Task: 2.1 Create custom Hypothesis generators for PPM domain objects
        **Validates: Requirements 1.5**
        """
        user_id = draw(st.uuids())
        role = draw(st.sampled_from(DomainGenerators.USER_ROLES))
        role_level = DomainGenerators.ROLE_HIERARCHY.get(role, 0)
        
        # Generate assignment timestamp (use dates and convert to datetime)
        assigned_date = draw(st.dates(
            min_value=date(2020, 1, 1),
            max_value=date(2030, 12, 31)
        ))
        assigned_at = datetime.combine(assigned_date, datetime.min.time(), tzinfo=timezone.utc)
        
        assignment = {
            'id': draw(st.uuids()),
            'user_id': user_id,
            'role': role,
            'role_level': role_level,
            'assigned_at': assigned_at.isoformat(),
            'assigned_by': draw(st.uuids()),
            'is_active': draw(st.booleans())
        }
        
        # Add optional expiration
        has_expiration = draw(st.booleans())
        if has_expiration:
            # Expiration is after assignment
            days_until_expiry = draw(st.integers(min_value=1, max_value=365))
            expires_at = assigned_at + timedelta(days=days_until_expiry)
            assignment['expires_at'] = expires_at.isoformat()
        else:
            assignment['expires_at'] = None
        
        if include_scope:
            # Admin roles typically have organization-wide scope
            # Project managers typically have project scope
            if role == 'admin':
                scope_type = draw(st.sampled_from(['organization', None]))
            elif role == 'portfolio_manager':
                scope_type = draw(st.sampled_from(['portfolio', 'organization']))
            elif role == 'project_manager':
                scope_type = draw(st.sampled_from(['project', 'portfolio']))
            else:
                scope_type = draw(st.sampled_from(DomainGenerators.SCOPE_TYPES))
            
            assignment['scope_type'] = scope_type
            
            if scope_type is not None:
                assignment['scope_id'] = draw(st.uuids())
            else:
                assignment['scope_id'] = None
        
        if include_permissions:
            # Derive permissions based on role
            base_permissions = ['read']
            
            if role_level >= 40:  # analyst and above
                base_permissions.extend(['analyze', 'export'])
            
            if role_level >= 60:  # project_manager and above
                base_permissions.extend(['create', 'update', 'manage_tasks'])
            
            if role_level >= 80:  # portfolio_manager and above
                base_permissions.extend(['delete', 'manage_projects', 'manage_resources'])
            
            if role_level >= 100:  # admin
                base_permissions.extend(['admin', 'manage_users', 'manage_roles', 'system_config'])
            
            assignment['permissions'] = base_permissions
            assignment['can_delegate'] = role_level >= 80  # Only portfolio_manager and admin can delegate
        
        return assignment
    
    @staticmethod
    @composite
    def portfolio_data(draw,
                      min_projects: int = 0,
                      max_projects: int = 20) -> Dict[str, Any]:
        """
        Generate portfolio data with optional project references.
        
        Args:
            draw: Hypothesis draw function
            min_projects: Minimum number of projects
            max_projects: Maximum number of projects
            
        Returns:
            Dict containing portfolio data with:
            - name: Portfolio name
            - description: Portfolio description
            - project_ids: List of project UUIDs
            - total_budget: Aggregated budget
            - health: Overall health indicator
            
        **Validates: Requirements 1.5**
        """
        name = draw(st.text(
            alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')),
            min_size=1,
            max_size=100
        ).filter(lambda x: x.strip()))
        
        num_projects = draw(st.integers(min_value=min_projects, max_value=max_projects))
        project_ids = [draw(st.uuids()) for _ in range(num_projects)]
        
        total_budget = draw(st.floats(
            min_value=0,
            max_value=100_000_000,
            allow_nan=False,
            allow_infinity=False
        ))
        
        return {
            'id': draw(st.uuids()),
            'name': name.strip() if name.strip() else "Portfolio",
            'description': draw(st.text(max_size=500)),
            'project_ids': [str(pid) for pid in project_ids],
            'total_budget': round(total_budget, 2),
            'health': draw(st.sampled_from(DomainGenerators.HEALTH_INDICATORS)),
            'organization_id': draw(st.uuids()),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    @composite
    def risk_record(draw) -> Dict[str, Any]:
        """
        Generate risk record data for risk management testing.
        
        Args:
            draw: Hypothesis draw function
            
        Returns:
            Dict containing risk record with:
            - title: Risk title
            - description: Risk description
            - category: Risk category
            - probability: Probability score (0-1)
            - impact: Impact score (0-1)
            - risk_score: Calculated risk score
            - status: Risk status
            
        **Validates: Requirements 1.5**
        """
        probability = draw(st.floats(min_value=0, max_value=1, allow_nan=False))
        impact = draw(st.floats(min_value=0, max_value=1, allow_nan=False))
        
        # Round probability and impact first, then calculate risk_score
        rounded_probability = round(probability, 2)
        rounded_impact = round(impact, 2)
        risk_score = rounded_probability * rounded_impact
        
        return {
            'id': draw(st.uuids()),
            'title': draw(st.text(min_size=1, max_size=100).filter(lambda x: x.strip())),
            'description': draw(st.text(max_size=500)),
            'category': draw(st.sampled_from(DomainGenerators.RISK_CATEGORIES)),
            'probability': rounded_probability,
            'impact': rounded_impact,
            'risk_score': round(risk_score, 4),
            'status': draw(st.sampled_from(['identified', 'analyzing', 'mitigating', 'resolved', 'accepted'])),
            'project_id': draw(st.uuids()),
            'owner_id': draw(st.uuids()),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    @composite
    def resource_allocation(draw,
                           max_percentage: float = 100.0) -> Dict[str, Any]:
        """
        Generate resource allocation data for capacity planning testing.
        
        Args:
            draw: Hypothesis draw function
            max_percentage: Maximum allocation percentage
            
        Returns:
            Dict containing resource allocation with:
            - resource_id: UUID of the resource
            - project_id: UUID of the project
            - allocation_percentage: Percentage of time allocated
            - hours_per_week: Hours allocated per week
            - start_date: Allocation start date
            - end_date: Allocation end date
            
        **Validates: Requirements 1.5**
        """
        allocation_percentage = draw(st.floats(
            min_value=0,
            max_value=max_percentage,
            allow_nan=False,
            allow_infinity=False
        ))
        
        # Calculate hours based on percentage (assuming 40-hour week)
        hours_per_week = (allocation_percentage / 100) * 40
        
        start_date = draw(st.dates(
            min_value=date(2020, 1, 1),
            max_value=date(2030, 12, 31)
        ))
        
        duration_days = draw(st.integers(min_value=1, max_value=365))
        end_date = start_date + timedelta(days=duration_days)
        
        return {
            'id': draw(st.uuids()),
            'resource_id': draw(st.uuids()),
            'project_id': draw(st.uuids()),
            'allocation_percentage': round(allocation_percentage, 2),
            'hours_per_week': round(hours_per_week, 2),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'role': draw(st.sampled_from(['developer', 'designer', 'analyst', 'manager', 'tester'])),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    @composite
    def change_request(draw) -> Dict[str, Any]:
        """
        Generate change request data for change management testing.
        
        Args:
            draw: Hypothesis draw function
            
        Returns:
            Dict containing change request with:
            - title: Change request title
            - description: Change description
            - change_type: Type of change
            - priority: Priority level
            - status: Current status
            - cost_impact: Estimated cost impact
            - schedule_impact_days: Estimated schedule impact
            
        **Validates: Requirements 1.5**
        """
        return {
            'id': draw(st.uuids()),
            'change_number': f"CR-{draw(st.integers(min_value=1000, max_value=9999))}",
            'title': draw(st.text(min_size=5, max_size=100).filter(lambda x: x.strip())),
            'description': draw(st.text(min_size=10, max_size=500)),
            'change_type': draw(st.sampled_from(DomainGenerators.CHANGE_TYPES)),
            'priority': draw(st.sampled_from(DomainGenerators.PRIORITY_LEVELS)),
            'status': draw(st.sampled_from(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented'])),
            'requested_by': draw(st.uuids()),
            'project_id': draw(st.uuids()),
            'cost_impact': round(draw(st.floats(min_value=-100000, max_value=1000000, allow_nan=False)), 2),
            'schedule_impact_days': draw(st.integers(min_value=-30, max_value=365)),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    @composite
    def audit_event(draw) -> Dict[str, Any]:
        """
        Generate audit event data for audit trail testing.
        
        Args:
            draw: Hypothesis draw function
            
        Returns:
            Dict containing audit event with:
            - event_type: Type of audit event
            - entity_type: Type of entity being audited
            - entity_id: UUID of the entity
            - performed_by: UUID of the user
            - old_values: Previous values
            - new_values: New values
            
        **Validates: Requirements 1.5**
        """
        event_types = ['created', 'updated', 'deleted', 'approved', 'rejected', 'viewed']
        entity_types = ['project', 'portfolio', 'risk', 'change_request', 'resource', 'user']
        
        return {
            'id': draw(st.uuids()),
            'event_type': draw(st.sampled_from(event_types)),
            'entity_type': draw(st.sampled_from(entity_types)),
            'entity_id': draw(st.uuids()),
            'performed_by': draw(st.uuids()),
            'performed_at': datetime.now(timezone.utc).isoformat(),
            'old_values': draw(st.dictionaries(
                st.text(min_size=1, max_size=20),
                st.one_of(st.text(max_size=50), st.integers(), st.floats(allow_nan=False)),
                max_size=5
            )),
            'new_values': draw(st.dictionaries(
                st.text(min_size=1, max_size=20),
                st.one_of(st.text(max_size=50), st.integers(), st.floats(allow_nan=False)),
                max_size=5
            )),
            'ip_address': draw(st.ip_addresses()).compressed,
            'user_agent': draw(st.text(max_size=100))
        }


# Convenience functions for direct strategy access
def project_data_strategy(**kwargs) -> st.SearchStrategy:
    """Get project data strategy with optional configuration."""
    return DomainGenerators.project_data(**kwargs)


def financial_record_strategy(**kwargs) -> st.SearchStrategy:
    """Get financial record strategy with optional configuration."""
    return DomainGenerators.financial_record(**kwargs)


def user_role_assignment_strategy(**kwargs) -> st.SearchStrategy:
    """Get user role assignment strategy with optional configuration."""
    return DomainGenerators.user_role_assignment(**kwargs)


def portfolio_data_strategy(**kwargs) -> st.SearchStrategy:
    """Get portfolio data strategy with optional configuration."""
    return DomainGenerators.portfolio_data(**kwargs)


def risk_record_strategy(**kwargs) -> st.SearchStrategy:
    """Get risk record strategy with optional configuration."""
    return DomainGenerators.risk_record()


def resource_allocation_strategy(**kwargs) -> st.SearchStrategy:
    """Get resource allocation strategy with optional configuration."""
    return DomainGenerators.resource_allocation(**kwargs)


def change_request_strategy(**kwargs) -> st.SearchStrategy:
    """Get change request strategy with optional configuration."""
    return DomainGenerators.change_request()


def audit_event_strategy(**kwargs) -> st.SearchStrategy:
    """Get audit event strategy with optional configuration."""
    return DomainGenerators.audit_event()


# Additional specialized generators for edge case testing

@composite
def edge_case_financial_record(draw) -> Dict[str, Any]:
    """
    Generate financial records specifically for edge case testing.
    
    Generates records with:
    - Zero budgets
    - Very small amounts (near zero)
    - Very large amounts
    - Extreme variance percentages
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    edge_case_type = draw(st.sampled_from([
        'zero_budget',
        'tiny_amount',
        'large_amount',
        'extreme_over_budget',
        'extreme_under_budget'
    ]))
    
    currency = draw(st.sampled_from(DomainGenerators.CURRENCIES))
    
    if edge_case_type == 'zero_budget':
        planned_amount = 0.0
        actual_amount = draw(st.floats(min_value=0, max_value=1000, allow_nan=False))
    elif edge_case_type == 'tiny_amount':
        planned_amount = draw(st.floats(min_value=0.01, max_value=1.0, allow_nan=False))
        actual_amount = draw(st.floats(min_value=0.01, max_value=2.0, allow_nan=False))
    elif edge_case_type == 'large_amount':
        planned_amount = draw(st.floats(min_value=1_000_000, max_value=100_000_000, allow_nan=False))
        actual_amount = draw(st.floats(min_value=500_000, max_value=150_000_000, allow_nan=False))
    elif edge_case_type == 'extreme_over_budget':
        planned_amount = draw(st.floats(min_value=1000, max_value=100000, allow_nan=False))
        actual_amount = planned_amount * draw(st.floats(min_value=2.0, max_value=10.0, allow_nan=False))
    else:  # extreme_under_budget
        planned_amount = draw(st.floats(min_value=1000, max_value=100000, allow_nan=False))
        actual_amount = planned_amount * draw(st.floats(min_value=0.01, max_value=0.3, allow_nan=False))
    
    variance_amount = actual_amount - planned_amount
    variance_percentage = (variance_amount / planned_amount * 100) if planned_amount > 0 else (100 if actual_amount > 0 else 0)
    
    return {
        'id': draw(st.uuids()),
        'edge_case_type': edge_case_type,
        'planned_amount': round(planned_amount, 2),
        'actual_amount': round(actual_amount, 2),
        'currency': currency,
        'variance_amount': round(variance_amount, 2),
        'variance_percentage': round(variance_percentage, 2),
        'created_at': datetime.now(timezone.utc).isoformat()
    }


@composite
def currency_conversion_pair(draw) -> Dict[str, Any]:
    """
    Generate currency conversion test data for reciprocal consistency testing.
    
    Generates pairs of currencies with amounts for testing that:
    A -> B -> A conversions maintain value within precision limits.
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    from_currency = draw(st.sampled_from(DomainGenerators.CURRENCIES))
    to_currency = draw(st.sampled_from(DomainGenerators.CURRENCIES))
    
    # Get realistic exchange rates
    from_rate_range = DomainGenerators.CURRENCY_EXCHANGE_RATES.get(from_currency, (0.5, 2.0))
    to_rate_range = DomainGenerators.CURRENCY_EXCHANGE_RATES.get(to_currency, (0.5, 2.0))
    
    from_rate = draw(st.floats(
        min_value=from_rate_range[0],
        max_value=from_rate_range[1],
        allow_nan=False
    ))
    
    to_rate = draw(st.floats(
        min_value=to_rate_range[0],
        max_value=to_rate_range[1],
        allow_nan=False
    ))
    
    amount = draw(st.floats(min_value=0.01, max_value=1_000_000, allow_nan=False))
    
    return {
        'from_currency': from_currency,
        'to_currency': to_currency,
        'from_rate_to_usd': round(from_rate, 6),
        'to_rate_to_usd': round(to_rate, 6),
        'amount': round(amount, 2)
    }


@composite
def rbac_test_scenario(draw) -> Dict[str, Any]:
    """
    Generate complete RBAC test scenarios with user, role, and resource.
    
    Creates realistic scenarios for testing role-based access control including:
    - User with role assignment
    - Target resource with required permissions
    - Expected access decision
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    # Generate user with role
    user_assignment = draw(DomainGenerators.user_role_assignment())
    
    # Generate target resource
    resource_type = draw(st.sampled_from(['project', 'portfolio', 'report', 'user', 'settings']))
    
    # Define required permissions for actions
    action = draw(st.sampled_from(['read', 'create', 'update', 'delete', 'admin']))
    
    required_permission_map = {
        'read': 'read',
        'create': 'create',
        'update': 'update',
        'delete': 'delete',
        'admin': 'admin'
    }
    
    required_permission = required_permission_map[action]
    
    # Determine expected access based on user's permissions
    user_permissions = user_assignment.get('permissions', ['read'])
    expected_access = required_permission in user_permissions
    
    return {
        'user_id': user_assignment['user_id'],
        'user_role': user_assignment['role'],
        'user_role_level': user_assignment['role_level'],
        'user_permissions': user_permissions,
        'user_scope_type': user_assignment.get('scope_type'),
        'user_scope_id': user_assignment.get('scope_id'),
        'resource_type': resource_type,
        'resource_id': draw(st.uuids()),
        'action': action,
        'required_permission': required_permission,
        'expected_access': expected_access,
        'is_active': user_assignment['is_active']
    }


@composite
def project_with_financials(draw) -> Dict[str, Any]:
    """
    Generate a complete project with associated financial records.
    
    Creates a realistic project with multiple financial records for
    comprehensive testing of project financial calculations.
    
    Task: 2.1 Create custom Hypothesis generators for PPM domain objects
    **Validates: Requirements 1.5**
    """
    project = draw(DomainGenerators.project_data())
    
    # Generate 1-10 financial records for the project
    num_records = draw(st.integers(min_value=1, max_value=10))
    
    # Distribute budget across records
    total_planned = project['budget']
    records = []
    remaining_budget = total_planned
    
    for i in range(num_records):
        if i == num_records - 1:
            # Last record gets remaining budget
            planned = remaining_budget
        else:
            # Allocate a portion of remaining budget
            portion = draw(st.floats(min_value=0.1, max_value=0.5, allow_nan=False))
            planned = remaining_budget * portion
            remaining_budget -= planned
        
        record = draw(DomainGenerators.financial_record(
            min_amount=0,
            max_amount=max(planned * 1.5, 1)
        ))
        record['project_id'] = project['id']
        record['planned_amount'] = round(planned, 2)
        records.append(record)
    
    # Calculate aggregated financials
    total_planned = sum(r['planned_amount'] for r in records)
    total_actual = sum(r['actual_amount'] for r in records)
    total_variance = total_actual - total_planned
    variance_percentage = (total_variance / total_planned * 100) if total_planned > 0 else 0
    
    return {
        'project': project,
        'financial_records': records,
        'aggregated': {
            'total_planned': round(total_planned, 2),
            'total_actual': round(total_actual, 2),
            'total_variance': round(total_variance, 2),
            'variance_percentage': round(variance_percentage, 2)
        }
    }


# Export all generators
__all__ = [
    'DomainGenerators',
    'project_data_strategy',
    'financial_record_strategy',
    'user_role_assignment_strategy',
    'portfolio_data_strategy',
    'risk_record_strategy',
    'resource_allocation_strategy',
    'change_request_strategy',
    'audit_event_strategy',
    'edge_case_financial_record',
    'currency_conversion_pair',
    'rbac_test_scenario',
    'project_with_financials'
]
