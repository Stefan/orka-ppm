"""
EAC (Estimate at Completion) Calculator Service
Implements multiple EAC calculation methods for project controls
"""

import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID, uuid4

from .project_controls_base import ProjectControlsBaseService
from models.project_controls import (
    EACCalculationMethod, EACCalculationCreate, EACCalculationResponse,
    ValidationResult, CalculationResult, PerformanceIndices
)

logger = logging.getLogger(__name__)


class EACCalculatorService(ProjectControlsBaseService):
    """Service for calculating Estimate at Completion using various methods"""
    
    def __init__(self, supabase_client):
        super().__init__(supabase_client)
        
        # EAC-specific parameters
        self.minimum_progress_threshold = Decimal('0.05')  # 5% minimum progress for reliable calculations
        self.maximum_eac_multiplier = Decimal('5.0')  # Maximum EAC as multiple of BAC
        
        # Method weights for comparison analysis
        self.method_reliability_weights = {
            EACCalculationMethod.current_performance: 0.3,
            EACCalculationMethod.budget_performance: 0.25,
            EACCalculationMethod.management_forecast: 0.25,
            EACCalculationMethod.bottom_up: 0.2
        }

    async def calculate_current_performance_eac(self, project_id: UUID) -> CalculationResult:
        """
        Calculate EAC using current performance: EAC = AC + (BAC - EV) / CPI
        
        Args:
            project_id: Project identifier
            
        Returns:
            CalculationResult with current performance EAC calculation
        """
        try:
            logger.info(f"Calculating current performance EAC for project {project_id}")
            
            # Get financial data
            financial_data = await self.get_financial_data(project_id)
            
            budget_at_completion = financial_data['budget_at_completion']
            earned_value = financial_data['earned_value']
            actual_cost = financial_data['actual_cost']
            planned_value = financial_data['planned_value']
            
            # Calculate performance indices
            performance_indices = self.calculate_performance_indices(
                planned_value, earned_value, actual_cost, budget_at_completion
            )
            
            cpi = performance_indices['cost_performance_index']
            
            # Calculate EAC using current performance method
            # EAC = AC + (BAC - EV) / CPI
            remaining_budget = budget_at_completion - earned_value
            
            if cpi <= self.minimum_cpi_threshold:
                # CPI too low, use remaining budget as ETC (conservative approach)
                eac = actual_cost + remaining_budget
                confidence_level = 0.2  # Low confidence due to poor performance data
            else:
                etc = remaining_budget / cpi
                eac = actual_cost + etc
                confidence_level = self._calculate_current_performance_confidence(
                    cpi, earned_value, budget_at_completion
                )
            
            # Calculate variance at completion
            vac = budget_at_completion - eac
            
            # Validate calculation
            validation = self._validate_eac_calculation(
                budget_at_completion, actual_cost, earned_value, eac, cpi
            )
            
            # Log calculation
            await self.log_calculation(
                'EAC', project_id, 'current_performance', eac,
                {
                    'cpi': float(cpi),
                    'remaining_budget': float(remaining_budget),
                    'vac': float(vac),
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=eac.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=EACCalculationMethod.current_performance,
                input_parameters={
                    'project_id': str(project_id),
                    'budget_at_completion': float(budget_at_completion),
                    'actual_cost': float(actual_cost),
                    'earned_value': float(earned_value),
                    'cpi': float(cpi),
                    'variance_at_completion': float(vac)
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Current performance EAC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=EACCalculationMethod.current_performance,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_budget_performance_eac(self, project_id: UUID) -> CalculationResult:
        """
        Calculate EAC using budget performance: EAC = AC + (BAC - EV) / (CPI × SPI)
        
        Args:
            project_id: Project identifier
            
        Returns:
            CalculationResult with budget performance EAC calculation
        """
        try:
            logger.info(f"Calculating budget performance EAC for project {project_id}")
            
            # Get financial data
            financial_data = await self.get_financial_data(project_id)
            
            budget_at_completion = financial_data['budget_at_completion']
            earned_value = financial_data['earned_value']
            actual_cost = financial_data['actual_cost']
            planned_value = financial_data['planned_value']
            
            # Calculate performance indices
            performance_indices = self.calculate_performance_indices(
                planned_value, earned_value, actual_cost, budget_at_completion
            )
            
            cpi = performance_indices['cost_performance_index']
            spi = performance_indices['schedule_performance_index']
            
            # Calculate EAC using budget performance method
            # EAC = AC + (BAC - EV) / (CPI × SPI)
            remaining_budget = budget_at_completion - earned_value
            combined_performance_index = cpi * spi
            
            if combined_performance_index <= self.minimum_cpi_threshold:
                # Combined performance too low, use conservative approach
                eac = actual_cost + remaining_budget
                confidence_level = 0.2
            else:
                etc = remaining_budget / combined_performance_index
                eac = actual_cost + etc
                confidence_level = self._calculate_budget_performance_confidence(
                    cpi, spi, earned_value, budget_at_completion
                )
            
            # Calculate variance at completion
            vac = budget_at_completion - eac
            
            # Validate calculation
            validation = self._validate_eac_calculation(
                budget_at_completion, actual_cost, earned_value, eac, combined_performance_index
            )
            
            # Log calculation
            await self.log_calculation(
                'EAC', project_id, 'budget_performance', eac,
                {
                    'cpi': float(cpi),
                    'spi': float(spi),
                    'combined_performance_index': float(combined_performance_index),
                    'remaining_budget': float(remaining_budget),
                    'vac': float(vac),
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=eac.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=EACCalculationMethod.budget_performance,
                input_parameters={
                    'project_id': str(project_id),
                    'budget_at_completion': float(budget_at_completion),
                    'actual_cost': float(actual_cost),
                    'earned_value': float(earned_value),
                    'cpi': float(cpi),
                    'spi': float(spi),
                    'combined_performance_index': float(combined_performance_index),
                    'variance_at_completion': float(vac)
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Budget performance EAC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=EACCalculationMethod.budget_performance,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_management_forecast_eac(self, project_id: UUID, 
                                              management_etc: Decimal,
                                              justification: Optional[str] = None,
                                              user_id: Optional[UUID] = None) -> CalculationResult:
        """
        Calculate EAC using management forecast: EAC = AC + Management ETC
        
        Args:
            project_id: Project identifier
            management_etc: Management's estimate to complete
            justification: Justification for management estimate
            user_id: User providing the estimate
            
        Returns:
            CalculationResult with management forecast EAC calculation
        """
        try:
            logger.info(f"Calculating management forecast EAC for project {project_id}")
            
            # Get financial data
            financial_data = await self.get_financial_data(project_id)
            
            budget_at_completion = financial_data['budget_at_completion']
            actual_cost = financial_data['actual_cost']
            earned_value = financial_data['earned_value']
            
            # Calculate EAC using management forecast method
            # EAC = AC + Management ETC
            eac = actual_cost + management_etc
            
            # Calculate variance at completion
            vac = budget_at_completion - eac
            
            # Calculate confidence based on justification quality and user expertise
            confidence_level = await self._calculate_management_forecast_confidence(
                user_id, justification, management_etc, budget_at_completion - actual_cost
            )
            
            # Validate calculation
            validation = self._validate_management_forecast(
                project_id, management_etc, justification, eac, budget_at_completion
            )
            
            # Log calculation
            await self.log_calculation(
                'EAC', project_id, 'management_forecast', eac,
                {
                    'management_etc': float(management_etc),
                    'actual_cost': float(actual_cost),
                    'vac': float(vac),
                    'justification': justification or '',
                    'user_id': str(user_id) if user_id else 'system',
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=eac.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=EACCalculationMethod.management_forecast,
                input_parameters={
                    'project_id': str(project_id),
                    'budget_at_completion': float(budget_at_completion),
                    'actual_cost': float(actual_cost),
                    'earned_value': float(earned_value),
                    'management_etc': float(management_etc),
                    'variance_at_completion': float(vac),
                    'justification': justification or '',
                    'user_id': str(user_id) if user_id else 'system'
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Management forecast EAC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=EACCalculationMethod.management_forecast,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_bottom_up_eac(self, project_id: UUID, 
                                    work_package_ids: Optional[List[UUID]] = None) -> CalculationResult:
        """
        Calculate EAC using bottom-up estimates: EAC = AC + Sum of remaining work estimates
        
        Args:
            project_id: Project identifier
            work_package_ids: Specific work packages to include (optional)
            
        Returns:
            CalculationResult with bottom-up EAC calculation
        """
        try:
            logger.info(f"Calculating bottom-up EAC for project {project_id}")
            
            # Get financial data
            financial_data = await self.get_financial_data(project_id)
            actual_cost = financial_data['actual_cost']
            budget_at_completion = financial_data['budget_at_completion']
            
            # Get work packages
            work_packages = await self.get_work_packages(project_id)
            
            if work_package_ids:
                work_packages = [wp for wp in work_packages 
                               if wp['id'] in [str(wp_id) for wp_id in work_package_ids]]
            
            if not work_packages:
                return CalculationResult(
                    calculation_id=str(uuid4()),
                    result_value=Decimal('0'),
                    confidence_level=0.0,
                    calculation_method=EACCalculationMethod.bottom_up,
                    input_parameters={'project_id': str(project_id)},
                    validation_result=ValidationResult(
                        is_valid=False,
                        errors=["No work packages found for project"]
                    ),
                    calculated_at=datetime.now()
                )
            
            # Calculate bottom-up ETC
            total_etc = Decimal('0')
            completed_packages = 0
            
            for wp in work_packages:
                budget = Decimal(str(wp.get('budget', 0)))
                percent_complete = Decimal(str(wp.get('percent_complete', 0))) / 100
                wp_actual_cost = Decimal(str(wp.get('actual_cost', 0)))
                
                if percent_complete >= 1.0:
                    # Package is complete, no remaining cost
                    completed_packages += 1
                    continue
                
                # Calculate remaining work for this package
                remaining_budget = budget * (1 - percent_complete)
                
                # Performance-based adjustment if we have actual cost data
                if wp_actual_cost > 0 and percent_complete > 0:
                    # Calculate work package CPI
                    earned_value = budget * percent_complete
                    wp_cpi = earned_value / wp_actual_cost if wp_actual_cost > 0 else Decimal('1.0')
                    
                    # Adjust remaining work based on performance
                    remaining_work_adjusted = remaining_budget / wp_cpi if wp_cpi > 0 else remaining_budget
                    total_etc += remaining_work_adjusted
                else:
                    # Use remaining budget if no performance data
                    total_etc += remaining_budget
            
            # Calculate EAC = AC + ETC
            eac = actual_cost + total_etc
            
            # Calculate variance at completion
            vac = budget_at_completion - eac
            
            # Calculate confidence level based on data quality
            confidence_level = self._calculate_bottom_up_confidence(work_packages, completed_packages)
            
            # Validate calculation
            validation = self._validate_eac_calculation(
                budget_at_completion, actual_cost, Decimal('0'), eac, Decimal('1.0')
            )
            
            # Log calculation
            await self.log_calculation(
                'EAC', project_id, 'bottom_up', eac,
                {
                    'work_packages_count': len(work_packages),
                    'completed_packages': completed_packages,
                    'total_etc': float(total_etc),
                    'actual_cost': float(actual_cost),
                    'vac': float(vac),
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=eac.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=EACCalculationMethod.bottom_up,
                input_parameters={
                    'project_id': str(project_id),
                    'budget_at_completion': float(budget_at_completion),
                    'actual_cost': float(actual_cost),
                    'total_etc': float(total_etc),
                    'work_packages_count': len(work_packages),
                    'completed_packages': completed_packages,
                    'variance_at_completion': float(vac)
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Bottom-up EAC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=EACCalculationMethod.bottom_up,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def compare_eac_methods(self, project_id: UUID, 
                                management_etc: Optional[Decimal] = None) -> Dict[str, Any]:
        """
        Compare different EAC calculation methods and provide variance analysis
        
        Args:
            project_id: Project identifier
            management_etc: Management ETC for management forecast method
            
        Returns:
            Dictionary with comparison results and variance analysis
        """
        try:
            logger.info(f"Comparing EAC methods for project {project_id}")
            
            # Calculate EAC using all methods
            calculations = {}
            
            # Current performance method
            current_perf_result = await self.calculate_current_performance_eac(project_id)
            if current_perf_result.validation_result.is_valid:
                calculations['current_performance'] = current_perf_result
            
            # Budget performance method
            budget_perf_result = await self.calculate_budget_performance_eac(project_id)
            if budget_perf_result.validation_result.is_valid:
                calculations['budget_performance'] = budget_perf_result
            
            # Management forecast method (if ETC provided)
            if management_etc is not None:
                mgmt_result = await self.calculate_management_forecast_eac(project_id, management_etc)
                if mgmt_result.validation_result.is_valid:
                    calculations['management_forecast'] = mgmt_result
            
            # Bottom-up method
            bottom_up_result = await self.calculate_bottom_up_eac(project_id)
            if bottom_up_result.validation_result.is_valid:
                calculations['bottom_up'] = bottom_up_result
            
            if not calculations:
                return {
                    'project_id': str(project_id),
                    'comparison_date': datetime.now(),
                    'calculations': [],
                    'recommended_method': None,
                    'variance_analysis': {},
                    'errors': ['No valid EAC calculations available']
                }
            
            # Calculate variance analysis
            eac_values = {method: calc.result_value for method, calc in calculations.items()}
            mean_eac = sum(eac_values.values()) / len(eac_values)
            
            variance_analysis = {}
            for method, eac_value in eac_values.items():
                variance_analysis[method] = {
                    'eac_value': float(eac_value),
                    'variance_from_mean': float(eac_value - mean_eac),
                    'variance_percentage': float((eac_value - mean_eac) / mean_eac * 100) if mean_eac > 0 else 0,
                    'confidence_level': calculations[method].confidence_level
                }
            
            # Recommend method based on confidence levels and reliability weights
            recommended_method = self._recommend_eac_method(calculations)
            
            # Log comparison
            await self.log_calculation(
                'EAC_COMPARISON', project_id, 'comparison', mean_eac,
                {
                    'methods_compared': list(calculations.keys()),
                    'recommended_method': recommended_method,
                    'variance_analysis': {k: v for k, v in variance_analysis.items()}
                }
            )
            
            return {
                'project_id': str(project_id),
                'comparison_date': datetime.now(),
                'calculations': [calc for calc in calculations.values()],
                'recommended_method': recommended_method,
                'variance_analysis': variance_analysis,
                'mean_eac': float(mean_eac),
                'eac_range': {
                    'minimum': float(min(eac_values.values())),
                    'maximum': float(max(eac_values.values()))
                }
            }
            
        except Exception as e:
            logger.error(f"EAC method comparison failed for project {project_id}: {e}")
            return {
                'project_id': str(project_id),
                'comparison_date': datetime.now(),
                'calculations': [],
                'recommended_method': None,
                'variance_analysis': {},
                'errors': [f"Comparison failed: {str(e)}"]
            }

    async def calculate(self, project_id: UUID, method: EACCalculationMethod, **kwargs) -> CalculationResult:
        """
        Main calculation method that routes to specific EAC calculation methods
        
        Args:
            project_id: Project identifier
            method: EAC calculation method to use
            **kwargs: Method-specific parameters
            
        Returns:
            CalculationResult with EAC calculation
        """
        if method == EACCalculationMethod.current_performance:
            return await self.calculate_current_performance_eac(project_id)
        elif method == EACCalculationMethod.budget_performance:
            return await self.calculate_budget_performance_eac(project_id)
        elif method == EACCalculationMethod.management_forecast:
            return await self.calculate_management_forecast_eac(
                project_id,
                kwargs.get('management_etc'),
                kwargs.get('justification', ''),
                kwargs.get('user_id')
            )
        elif method == EACCalculationMethod.bottom_up:
            return await self.calculate_bottom_up_eac(
                project_id,
                kwargs.get('work_package_ids')
            )
        else:
            raise ValueError(f"Unknown EAC calculation method: {method}")

    # Helper methods for confidence calculations
    
    def _calculate_current_performance_confidence(self, cpi: Decimal, earned_value: Decimal, 
                                                budget: Decimal) -> float:
        """Calculate confidence level for current performance EAC"""
        # Higher confidence when CPI is stable and we have significant earned value
        progress_ratio = float(earned_value / budget) if budget > 0 else 0
        cpi_stability = 1.0 - abs(float(cpi) - 1.0)  # Closer to 1.0 is more stable
        
        # Base confidence higher for current performance method
        confidence = 0.5 + (progress_ratio * 0.3) + (cpi_stability * 0.2)
        return min(max(confidence, 0.1), 1.0)
    
    def _calculate_budget_performance_confidence(self, cpi: Decimal, spi: Decimal, 
                                               earned_value: Decimal, budget: Decimal) -> float:
        """Calculate confidence level for budget performance EAC"""
        progress_ratio = float(earned_value / budget) if budget > 0 else 0
        
        # Consider both CPI and SPI stability
        cpi_stability = 1.0 - abs(float(cpi) - 1.0)
        spi_stability = 1.0 - abs(float(spi) - 1.0)
        combined_stability = (cpi_stability + spi_stability) / 2
        
        confidence = 0.4 + (progress_ratio * 0.3) + (combined_stability * 0.3)
        return min(max(confidence, 0.1), 1.0)
    
    async def _calculate_management_forecast_confidence(self, user_id: Optional[UUID], 
                                                      justification: Optional[str],
                                                      management_etc: Decimal,
                                                      remaining_budget: Decimal) -> float:
        """Calculate confidence level for management forecast EAC"""
        base_confidence = 0.6  # Higher base confidence for management input
        
        # Adjust based on justification quality
        if justification and len(justification) > 100:
            base_confidence += 0.2
        elif justification and len(justification) > 50:
            base_confidence += 0.1
        
        # Adjust based on reasonableness of estimate
        if remaining_budget > 0:
            etc_ratio = float(management_etc / remaining_budget)
            if 0.5 <= etc_ratio <= 2.0:  # Reasonable range
                base_confidence += 0.1
            elif etc_ratio > 3.0 or etc_ratio < 0.3:  # Unreasonable range
                base_confidence -= 0.2
        
        return min(max(base_confidence, 0.1), 1.0)
    
    def _calculate_bottom_up_confidence(self, work_packages: List[Dict], completed_packages: int) -> float:
        """Calculate confidence level for bottom-up EAC"""
        if not work_packages:
            return 0.0
        
        # Base confidence on data completeness and progress
        completion_ratio = completed_packages / len(work_packages)
        data_quality = sum(1 for wp in work_packages if wp.get('actual_cost', 0) > 0) / len(work_packages)
        
        # Higher confidence with more completed work and better data
        confidence = 0.6 + (completion_ratio * 0.2) + (data_quality * 0.2)
        return min(confidence, 1.0)
    
    def _validate_eac_calculation(self, budget: Decimal, actual_cost: Decimal, 
                                earned_value: Decimal, eac: Decimal, 
                                performance_index: Decimal) -> ValidationResult:
        """Validate EAC calculation results"""
        errors = []
        warnings = []
        recommendations = []
        
        # Basic validation
        if eac <= 0:
            errors.append("EAC must be positive")
        
        if eac < actual_cost:
            errors.append("EAC cannot be less than actual cost incurred")
        
        # Reasonableness checks
        if budget > 0:
            eac_ratio = eac / budget
            if eac_ratio > self.maximum_eac_multiplier:
                warnings.append(f"EAC is {float(eac_ratio):.1f}x the original budget - please verify")
            elif eac_ratio < 0.5:
                warnings.append("EAC is significantly below original budget - please verify")
        
        # Performance-based warnings
        if performance_index < 0.8:
            warnings.append("Poor performance index may affect EAC accuracy")
            recommendations.append("Consider using management forecast or bottom-up method")
        
        # Progress-based recommendations
        if earned_value > 0 and budget > 0:
            progress_ratio = earned_value / budget
            if progress_ratio < 0.1:
                recommendations.append("Limited progress data - EAC accuracy may be low")
            elif progress_ratio > 0.8:
                recommendations.append("Project is near completion - consider detailed bottom-up analysis")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            recommendations=recommendations
        )
    
    def _validate_management_forecast(self, project_id: UUID, management_etc: Decimal,
                                    justification: Optional[str], eac: Decimal,
                                    budget: Decimal) -> ValidationResult:
        """Validate management forecast EAC"""
        errors = []
        warnings = []
        recommendations = []
        
        if management_etc <= 0:
            errors.append("Management ETC must be positive")
        
        if not justification or len(justification.strip()) < 10:
            warnings.append("Management forecast should include detailed justification")
        
        if budget > 0:
            eac_ratio = eac / budget
            if eac_ratio > 2.0:
                warnings.append("Management forecast significantly exceeds budget")
                recommendations.append("Consider risk mitigation strategies")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            recommendations=recommendations
        )
    
    def _recommend_eac_method(self, calculations: Dict[str, CalculationResult]) -> str:
        """Recommend the most appropriate EAC method based on confidence and reliability"""
        if not calculations:
            return None
        
        # Calculate weighted scores for each method
        method_scores = {}
        for method, calc in calculations.items():
            reliability_weight = self.method_reliability_weights.get(method, 0.1)
            confidence_score = calc.confidence_level
            
            # Combine reliability weight and confidence
            method_scores[method] = reliability_weight * confidence_score
        
        # Return method with highest score
        recommended_method = max(method_scores.items(), key=lambda x: x[1])[0]
        return recommended_method