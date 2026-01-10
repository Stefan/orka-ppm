"""
Base service class for Project Controls services
Provides common functionality for ETC, EAC, and other project controls calculations
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID
from supabase import Client

from models.project_controls import ValidationResult

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProjectControlsBaseService(ABC):
    """Base service class for project controls calculations"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        
        # Common calculation parameters
        self.default_confidence_level = 0.8
        self.minimum_cpi_threshold = 0.1  # Prevent division by very small CPI values
        self.maximum_variance_threshold = 10.0  # 1000% variance threshold
        
        # Performance thresholds
        self.performance_thresholds = {
            'excellent': 1.1,    # CPI/SPI > 1.1
            'good': 1.0,         # CPI/SPI > 1.0
            'acceptable': 0.9,   # CPI/SPI > 0.9
            'poor': 0.8,         # CPI/SPI > 0.8
            'critical': 0.0      # CPI/SPI <= 0.8
        }

    async def get_project_data(self, project_id: UUID) -> Optional[Dict[str, Any]]:
        """Get basic project data including budget and current status"""
        try:
            result = self.supabase.table('projects')\
                .select('id, name, budget, start_date, end_date, status, currency_code')\
                .eq('id', str(project_id))\
                .execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get project data for {project_id}: {e}")
            return None

    async def get_work_packages(self, project_id: UUID, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get work packages for a project"""
        try:
            query = self.supabase.table('work_packages')\
                .select('*')\
                .eq('project_id', str(project_id))
            
            if active_only:
                query = query.eq('is_active', True)
            
            result = query.execute()
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get work packages for {project_id}: {e}")
            return []

    async def get_financial_data(self, project_id: UUID) -> Dict[str, Decimal]:
        """Get current financial data for a project"""
        try:
            # Get actual costs from financial tracking
            financial_result = self.supabase.table('financial_tracking')\
                .select('actual_amount')\
                .eq('project_id', str(project_id))\
                .execute()
            
            actual_cost = Decimal('0')
            if financial_result.data:
                actual_cost = sum(Decimal(str(record['actual_amount'] or 0)) 
                                for record in financial_result.data)
            
            # Get budget from project
            project_data = await self.get_project_data(project_id)
            budget = Decimal(str(project_data.get('budget', 0))) if project_data else Decimal('0')
            
            # Get earned value from work packages
            work_packages = await self.get_work_packages(project_id)
            earned_value = sum(Decimal(str(wp.get('earned_value', 0))) for wp in work_packages)
            
            return {
                'budget_at_completion': budget,
                'actual_cost': actual_cost,
                'earned_value': earned_value,
                'planned_value': budget  # Simplified - would need schedule data for accurate PV
            }
            
        except Exception as e:
            logger.error(f"Failed to get financial data for {project_id}: {e}")
            return {
                'budget_at_completion': Decimal('0'),
                'actual_cost': Decimal('0'),
                'earned_value': Decimal('0'),
                'planned_value': Decimal('0')
            }

    def calculate_performance_indices(self, planned_value: Decimal, earned_value: Decimal, 
                                    actual_cost: Decimal, budget_at_completion: Decimal) -> Dict[str, Decimal]:
        """Calculate standard earned value performance indices"""
        try:
            # Cost Performance Index
            cpi = earned_value / actual_cost if actual_cost > 0 else Decimal('1.0')
            
            # Schedule Performance Index
            spi = earned_value / planned_value if planned_value > 0 else Decimal('1.0')
            
            # Cost Variance
            cost_variance = earned_value - actual_cost
            
            # Schedule Variance
            schedule_variance = earned_value - planned_value
            
            # To Complete Performance Index
            remaining_budget = budget_at_completion - earned_value
            remaining_cost = budget_at_completion - actual_cost
            tcpi = remaining_budget / remaining_cost if remaining_cost > 0 else Decimal('1.0')
            
            return {
                'cost_performance_index': cpi.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
                'schedule_performance_index': spi.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
                'cost_variance': cost_variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'schedule_variance': schedule_variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'to_complete_performance_index': tcpi.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            }
            
        except Exception as e:
            logger.error(f"Failed to calculate performance indices: {e}")
            return {
                'cost_performance_index': Decimal('1.0'),
                'schedule_performance_index': Decimal('1.0'),
                'cost_variance': Decimal('0.0'),
                'schedule_variance': Decimal('0.0'),
                'to_complete_performance_index': Decimal('1.0')
            }

    def validate_calculation_inputs(self, **kwargs) -> ValidationResult:
        """Validate common calculation inputs"""
        errors = []
        warnings = []
        recommendations = []
        
        # Check for negative values where they shouldn't be
        for key, value in kwargs.items():
            if key in ['budget', 'actual_cost', 'earned_value', 'remaining_cost'] and value < 0:
                errors.append(f"{key} cannot be negative: {value}")
        
        # Check for unrealistic performance indices
        if 'cpi' in kwargs:
            cpi = kwargs['cpi']
            if cpi < self.minimum_cpi_threshold:
                warnings.append(f"Very low CPI ({cpi}) may indicate data quality issues")
            elif cpi > self.maximum_variance_threshold:
                warnings.append(f"Very high CPI ({cpi}) may indicate data quality issues")
        
        # Check for zero budget
        if 'budget' in kwargs and kwargs['budget'] == 0:
            errors.append("Project budget cannot be zero")
        
        # Check for completion percentage
        if 'percent_complete' in kwargs:
            percent = kwargs['percent_complete']
            if percent < 0 or percent > 100:
                errors.append(f"Percent complete must be between 0 and 100: {percent}")
        
        # Provide recommendations based on performance
        if 'cpi' in kwargs and 'spi' in kwargs:
            cpi, spi = kwargs['cpi'], kwargs['spi']
            if cpi < 0.9 and spi < 0.9:
                recommendations.append("Both cost and schedule performance are below target. Consider corrective action.")
            elif cpi < 0.9:
                recommendations.append("Cost performance is below target. Review cost control measures.")
            elif spi < 0.9:
                recommendations.append("Schedule performance is below target. Review schedule recovery options.")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            recommendations=recommendations
        )

    def determine_performance_status(self, cpi: Decimal, spi: Decimal) -> str:
        """Determine overall performance status based on indices"""
        avg_performance = (cpi + spi) / 2
        
        if avg_performance >= self.performance_thresholds['excellent']:
            return 'excellent'
        elif avg_performance >= self.performance_thresholds['good']:
            return 'good'
        elif avg_performance >= self.performance_thresholds['acceptable']:
            return 'acceptable'
        elif avg_performance >= self.performance_thresholds['poor']:
            return 'poor'
        else:
            return 'critical'

    async def log_calculation(self, calculation_type: str, project_id: UUID, 
                            method: str, result: Decimal, inputs: Dict[str, Any]) -> None:
        """Log calculation for audit trail"""
        try:
            log_entry = {
                'id': str(UUID()),
                'calculation_type': calculation_type,
                'project_id': str(project_id),
                'method': method,
                'result': float(result),
                'inputs': inputs,
                'calculated_at': datetime.now().isoformat(),
                'calculated_by': inputs.get('user_id', 'system')
            }
            
            self.supabase.table('calculation_audit_log').insert(log_entry).execute()
            
        except Exception as e:
            logger.error(f"Failed to log calculation: {e}")

    def calculate_confidence_interval(self, base_value: Decimal, confidence_level: float, 
                                    historical_variance: Optional[Decimal] = None) -> Dict[str, Decimal]:
        """Calculate confidence interval for estimates"""
        try:
            if historical_variance is None:
                # Use default 20% variance if no historical data
                historical_variance = base_value * Decimal('0.2')
            
            # Simple confidence interval calculation
            # In practice, this would use statistical methods based on historical data
            z_score = Decimal('1.96') if confidence_level >= 0.95 else Decimal('1.645')  # 95% or 90%
            margin_of_error = z_score * historical_variance
            
            return {
                'lower_bound': (base_value - margin_of_error).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'upper_bound': (base_value + margin_of_error).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                'confidence_level': Decimal(str(confidence_level))
            }
            
        except Exception as e:
            logger.error(f"Failed to calculate confidence interval: {e}")
            return {
                'lower_bound': base_value,
                'upper_bound': base_value,
                'confidence_level': Decimal(str(confidence_level))
            }

    @abstractmethod
    async def calculate(self, project_id: UUID, **kwargs) -> Any:
        """Abstract method for specific calculations"""
        pass