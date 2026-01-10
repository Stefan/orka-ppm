"""
ETC (Estimate to Complete) Calculator Service
Implements multiple ETC calculation methods for project controls
"""

import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID, uuid4

from .project_controls_base import ProjectControlsBaseService
from models.project_controls import (
    ETCCalculationMethod, ETCCalculationCreate, ETCCalculationResponse,
    ValidationResult, CalculationResult
)

logger = logging.getLogger(__name__)


class ETCCalculatorService(ProjectControlsBaseService):
    """Service for calculating Estimate to Complete using various methods"""
    
    def __init__(self, supabase_client):
        super().__init__(supabase_client)
        
        # ETC-specific parameters
        self.default_productivity_factor = 1.0
        self.minimum_remaining_work = Decimal('0.01')  # Minimum remaining work threshold
        
        # Method weights for weighted average calculation
        self.method_weights = {
            ETCCalculationMethod.bottom_up: 0.4,
            ETCCalculationMethod.performance_based: 0.3,
            ETCCalculationMethod.parametric: 0.2,
            ETCCalculationMethod.manual: 0.1
        }

    async def calculate_bottom_up_etc(self, project_id: UUID, work_package_ids: Optional[List[UUID]] = None) -> CalculationResult:
        """
        Calculate ETC by summing detailed estimates for all remaining work packages
        
        Args:
            project_id: Project identifier
            work_package_ids: Specific work packages to include (optional)
            
        Returns:
            CalculationResult with bottom-up ETC calculation
        """
        try:
            logger.info(f"Calculating bottom-up ETC for project {project_id}")
            
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
                    calculation_method=ETCCalculationMethod.bottom_up,
                    input_parameters={'project_id': str(project_id), 'work_packages_count': 0},
                    validation_result=ValidationResult(
                        is_valid=False,
                        errors=["No work packages found for project"]
                    ),
                    calculated_at=datetime.now()
                )
            
            total_etc = Decimal('0')
            completed_packages = 0
            
            for wp in work_packages:
                budget = Decimal(str(wp.get('budget', 0)))
                percent_complete = Decimal(str(wp.get('percent_complete', 0))) / 100
                actual_cost = Decimal(str(wp.get('actual_cost', 0)))
                
                # Calculate remaining work for this package
                if percent_complete >= 1.0:
                    # Package is complete
                    completed_packages += 1
                    continue
                
                # Remaining budget approach
                remaining_budget = budget * (1 - percent_complete)
                
                # Performance-based adjustment if we have actual cost data
                if actual_cost > 0 and percent_complete > 0:
                    # Calculate work package CPI
                    earned_value = budget * percent_complete
                    wp_cpi = earned_value / actual_cost if actual_cost > 0 else Decimal('1.0')
                    
                    # Adjust remaining work based on performance
                    remaining_work_adjusted = remaining_budget / wp_cpi if wp_cpi > 0 else remaining_budget
                    total_etc += remaining_work_adjusted
                else:
                    # Use remaining budget if no performance data
                    total_etc += remaining_budget
            
            # Validate calculation
            validation = self.validate_calculation_inputs(
                remaining_cost=total_etc,
                work_packages_count=len(work_packages),
                completed_packages=completed_packages
            )
            
            # Calculate confidence level based on data quality
            confidence_level = self._calculate_bottom_up_confidence(work_packages, completed_packages)
            
            # Log calculation
            await self.log_calculation(
                'ETC', project_id, 'bottom_up', total_etc,
                {
                    'work_packages_count': len(work_packages),
                    'completed_packages': completed_packages,
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=total_etc.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=ETCCalculationMethod.bottom_up,
                input_parameters={
                    'project_id': str(project_id),
                    'work_packages_count': len(work_packages),
                    'completed_packages': completed_packages
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Bottom-up ETC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=ETCCalculationMethod.bottom_up,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_performance_based_etc(self, project_id: UUID) -> CalculationResult:
        """
        Calculate ETC using Cost Performance Index: ETC = (BAC - EV) / CPI
        
        Args:
            project_id: Project identifier
            
        Returns:
            CalculationResult with performance-based ETC calculation
        """
        try:
            logger.info(f"Calculating performance-based ETC for project {project_id}")
            
            # Get financial data
            financial_data = await self.get_financial_data(project_id)
            
            budget_at_completion = financial_data['budget_at_completion']
            earned_value = financial_data['earned_value']
            actual_cost = financial_data['actual_cost']
            
            # Calculate performance indices
            performance_indices = self.calculate_performance_indices(
                financial_data['planned_value'],
                earned_value,
                actual_cost,
                budget_at_completion
            )
            
            cpi = performance_indices['cost_performance_index']
            
            # Calculate ETC using performance-based method
            remaining_budget = budget_at_completion - earned_value
            
            if cpi <= self.minimum_cpi_threshold:
                # CPI too low, use remaining budget as ETC
                etc = remaining_budget
                confidence_level = 0.3  # Low confidence due to poor performance data
            else:
                etc = remaining_budget / cpi
                confidence_level = self._calculate_performance_based_confidence(cpi, earned_value, budget_at_completion)
            
            # Validate calculation
            validation = self.validate_calculation_inputs(
                budget=budget_at_completion,
                actual_cost=actual_cost,
                earned_value=earned_value,
                cpi=cpi,
                remaining_cost=etc
            )
            
            # Log calculation
            await self.log_calculation(
                'ETC', project_id, 'performance_based', etc,
                {
                    'cpi': float(cpi),
                    'remaining_budget': float(remaining_budget),
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=etc.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=ETCCalculationMethod.performance_based,
                input_parameters={
                    'project_id': str(project_id),
                    'cpi': float(cpi),
                    'remaining_budget': float(remaining_budget),
                    'budget_at_completion': float(budget_at_completion),
                    'earned_value': float(earned_value)
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Performance-based ETC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=ETCCalculationMethod.performance_based,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_parametric_etc(self, project_id: UUID, 
                                     productivity_factors: Optional[Dict[str, float]] = None) -> CalculationResult:
        """
        Calculate ETC using historical performance ratios and productivity factors
        
        Args:
            project_id: Project identifier
            productivity_factors: Custom productivity factors by work type
            
        Returns:
            CalculationResult with parametric ETC calculation
        """
        try:
            logger.info(f"Calculating parametric ETC for project {project_id}")
            
            # Get work packages and historical data
            work_packages = await self.get_work_packages(project_id)
            historical_factors = await self._get_historical_productivity_factors(project_id)
            
            # Use provided factors or historical defaults
            if productivity_factors:
                factors = {k: Decimal(str(v)) for k, v in productivity_factors.items()}
            else:
                factors = historical_factors
            
            total_etc = Decimal('0')
            packages_processed = 0
            
            for wp in work_packages:
                budget = Decimal(str(wp.get('budget', 0)))
                percent_complete = Decimal(str(wp.get('percent_complete', 0))) / 100
                
                if percent_complete >= 1.0:
                    continue  # Skip completed packages
                
                remaining_budget = budget * (1 - percent_complete)
                
                # Apply productivity factor based on work package type or default
                wp_name = wp.get('name', '').lower()
                factor = self._get_productivity_factor_for_work_package(wp_name, factors)
                
                # Calculate parametric ETC for this package
                parametric_etc = remaining_budget * factor
                total_etc += parametric_etc
                packages_processed += 1
            
            # Calculate confidence based on historical data quality
            confidence_level = self._calculate_parametric_confidence(factors, packages_processed)
            
            # Validate calculation
            validation = self.validate_calculation_inputs(
                remaining_cost=total_etc,
                work_packages_count=len(work_packages),
                productivity_factors=productivity_factors or {}
            )
            
            # Log calculation
            await self.log_calculation(
                'ETC', project_id, 'parametric', total_etc,
                {
                    'productivity_factors': productivity_factors or {},
                    'packages_processed': packages_processed,
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=total_etc.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=ETCCalculationMethod.parametric,
                input_parameters={
                    'project_id': str(project_id),
                    'productivity_factors': productivity_factors or {},
                    'packages_processed': packages_processed
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Parametric ETC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=ETCCalculationMethod.parametric,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_manual_etc(self, project_id: UUID, manual_estimate: Decimal, 
                                 justification: str, user_id: UUID) -> CalculationResult:
        """
        Process manual ETC estimate with validation and approval workflow
        
        Args:
            project_id: Project identifier
            manual_estimate: Manual ETC estimate
            justification: Justification for manual estimate
            user_id: User providing the estimate
            
        Returns:
            CalculationResult with manual ETC calculation
        """
        try:
            logger.info(f"Processing manual ETC for project {project_id}")
            
            # Get project data for validation
            project_data = await self.get_project_data(project_id)
            if not project_data:
                return CalculationResult(
                    calculation_id=str(uuid4()),
                    result_value=Decimal('0'),
                    confidence_level=0.0,
                    calculation_method=ETCCalculationMethod.manual,
                    input_parameters={'project_id': str(project_id)},
                    validation_result=ValidationResult(
                        is_valid=False,
                        errors=["Project not found"]
                    ),
                    calculated_at=datetime.now()
                )
            
            # Validate manual estimate
            validation = self._validate_manual_estimate(project_id, manual_estimate, justification)
            
            # Calculate confidence based on justification quality and user expertise
            confidence_level = await self._calculate_manual_confidence(user_id, justification)
            
            # Log calculation
            await self.log_calculation(
                'ETC', project_id, 'manual', manual_estimate,
                {
                    'user_id': str(user_id),
                    'justification': justification,
                    'confidence_level': confidence_level
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=manual_estimate.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=confidence_level,
                calculation_method=ETCCalculationMethod.manual,
                input_parameters={
                    'project_id': str(project_id),
                    'manual_estimate': float(manual_estimate),
                    'justification': justification,
                    'user_id': str(user_id)
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Manual ETC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method=ETCCalculationMethod.manual,
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate_weighted_etc(self, project_id: UUID, 
                                   etc_calculations: List[CalculationResult],
                                   custom_weights: Optional[Dict[str, float]] = None) -> CalculationResult:
        """
        Calculate weighted average ETC with confidence intervals
        
        Args:
            project_id: Project identifier
            etc_calculations: List of ETC calculations to combine
            custom_weights: Custom weights for different methods
            
        Returns:
            CalculationResult with weighted average ETC
        """
        try:
            logger.info(f"Calculating weighted ETC for project {project_id}")
            
            if not etc_calculations:
                return CalculationResult(
                    calculation_id=str(uuid4()),
                    result_value=Decimal('0'),
                    confidence_level=0.0,
                    calculation_method="weighted_average",
                    input_parameters={'project_id': str(project_id)},
                    validation_result=ValidationResult(
                        is_valid=False,
                        errors=["No ETC calculations provided"]
                    ),
                    calculated_at=datetime.now()
                )
            
            # Use custom weights or defaults
            weights = custom_weights or self.method_weights
            
            weighted_sum = Decimal('0')
            total_weight = Decimal('0')
            confidence_sum = Decimal('0')
            methods_used = []
            
            for calc in etc_calculations:
                if not calc.validation_result.is_valid:
                    continue  # Skip invalid calculations
                
                method = calc.calculation_method
                weight = Decimal(str(weights.get(method, 0.1)))  # Default small weight
                
                # Adjust weight by confidence level
                confidence_adjusted_weight = weight * Decimal(str(calc.confidence_level))
                
                weighted_sum += calc.result_value * confidence_adjusted_weight
                total_weight += confidence_adjusted_weight
                confidence_sum += Decimal(str(calc.confidence_level)) * weight
                methods_used.append(method)
            
            if total_weight == 0:
                return CalculationResult(
                    calculation_id=str(uuid4()),
                    result_value=Decimal('0'),
                    confidence_level=0.0,
                    calculation_method="weighted_average",
                    input_parameters={'project_id': str(project_id)},
                    validation_result=ValidationResult(
                        is_valid=False,
                        errors=["No valid calculations to combine"]
                    ),
                    calculated_at=datetime.now()
                )
            
            # Calculate weighted average
            weighted_etc = weighted_sum / total_weight
            weighted_confidence = confidence_sum / sum(Decimal(str(weights.get(m, 0.1))) for m in methods_used)
            
            # Calculate confidence interval
            confidence_interval = self.calculate_confidence_interval(
                weighted_etc, float(weighted_confidence)
            )
            
            # Validate result
            validation = self.validate_calculation_inputs(
                remaining_cost=weighted_etc,
                confidence_level=float(weighted_confidence)
            )
            
            # Log calculation
            await self.log_calculation(
                'ETC', project_id, 'weighted_average', weighted_etc,
                {
                    'methods_used': methods_used,
                    'weights_used': {k: v for k, v in weights.items() if k in methods_used},
                    'confidence_level': float(weighted_confidence),
                    'confidence_interval': {k: float(v) for k, v in confidence_interval.items()}
                }
            )
            
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=weighted_etc.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                confidence_level=float(weighted_confidence),
                calculation_method="weighted_average",
                input_parameters={
                    'project_id': str(project_id),
                    'methods_used': methods_used,
                    'weights_used': {k: v for k, v in weights.items() if k in methods_used},
                    'confidence_interval': {k: float(v) for k, v in confidence_interval.items()}
                },
                validation_result=validation,
                calculated_at=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Weighted ETC calculation failed for project {project_id}: {e}")
            return CalculationResult(
                calculation_id=str(uuid4()),
                result_value=Decimal('0'),
                confidence_level=0.0,
                calculation_method="weighted_average",
                input_parameters={'project_id': str(project_id)},
                validation_result=ValidationResult(
                    is_valid=False,
                    errors=[f"Calculation failed: {str(e)}"]
                ),
                calculated_at=datetime.now()
            )

    async def calculate(self, project_id: UUID, method: ETCCalculationMethod, **kwargs) -> CalculationResult:
        """
        Main calculation method that routes to specific ETC calculation methods
        
        Args:
            project_id: Project identifier
            method: ETC calculation method to use
            **kwargs: Method-specific parameters
            
        Returns:
            CalculationResult with ETC calculation
        """
        if method == ETCCalculationMethod.bottom_up:
            return await self.calculate_bottom_up_etc(
                project_id, 
                kwargs.get('work_package_ids')
            )
        elif method == ETCCalculationMethod.performance_based:
            return await self.calculate_performance_based_etc(project_id)
        elif method == ETCCalculationMethod.parametric:
            return await self.calculate_parametric_etc(
                project_id, 
                kwargs.get('productivity_factors')
            )
        elif method == ETCCalculationMethod.manual:
            return await self.calculate_manual_etc(
                project_id,
                kwargs.get('manual_estimate'),
                kwargs.get('justification', ''),
                kwargs.get('user_id')
            )
        else:
            raise ValueError(f"Unknown ETC calculation method: {method}")

    # Helper methods for confidence calculations
    
    def _calculate_bottom_up_confidence(self, work_packages: List[Dict], completed_packages: int) -> float:
        """Calculate confidence level for bottom-up ETC"""
        if not work_packages:
            return 0.0
        
        # Base confidence on data completeness and progress
        completion_ratio = completed_packages / len(work_packages)
        data_quality = sum(1 for wp in work_packages if wp.get('actual_cost', 0) > 0) / len(work_packages)
        
        # Higher confidence with more completed work and better data
        confidence = 0.5 + (completion_ratio * 0.3) + (data_quality * 0.2)
        return min(confidence, 1.0)
    
    def _calculate_performance_based_confidence(self, cpi: Decimal, earned_value: Decimal, 
                                              budget: Decimal) -> float:
        """Calculate confidence level for performance-based ETC"""
        # Higher confidence when CPI is stable and we have significant earned value
        progress_ratio = float(earned_value / budget) if budget > 0 else 0
        cpi_stability = 1.0 - abs(float(cpi) - 1.0)  # Closer to 1.0 is more stable
        
        confidence = 0.4 + (progress_ratio * 0.4) + (cpi_stability * 0.2)
        return min(max(confidence, 0.1), 1.0)
    
    def _calculate_parametric_confidence(self, factors: Dict[str, Decimal], packages_count: int) -> float:
        """Calculate confidence level for parametric ETC"""
        # Base confidence on number of historical factors and work packages
        factor_coverage = len(factors) / max(packages_count, 1)
        base_confidence = 0.3 + min(factor_coverage * 0.4, 0.4)
        
        # Adjust for data quality
        if packages_count > 10:
            base_confidence += 0.2
        elif packages_count > 5:
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)
    
    async def _calculate_manual_confidence(self, user_id: UUID, justification: str) -> float:
        """Calculate confidence level for manual ETC"""
        # Base confidence on justification quality
        base_confidence = 0.5
        
        if len(justification) > 100:  # Detailed justification
            base_confidence += 0.2
        elif len(justification) > 50:
            base_confidence += 0.1
        
        # Could add user expertise factor here based on historical accuracy
        # For now, use base confidence
        return min(base_confidence, 1.0)
    
    async def _get_historical_productivity_factors(self, project_id: UUID) -> Dict[str, Decimal]:
        """Get historical productivity factors for similar projects"""
        try:
            # This would query historical project data
            # For now, return default factors
            return {
                'design': Decimal('1.1'),
                'construction': Decimal('1.0'),
                'testing': Decimal('1.2'),
                'documentation': Decimal('0.9'),
                'default': Decimal('1.0')
            }
        except Exception as e:
            logger.error(f"Failed to get historical productivity factors: {e}")
            return {'default': Decimal('1.0')}
    
    def _get_productivity_factor_for_work_package(self, wp_name: str, 
                                                factors: Dict[str, Decimal]) -> Decimal:
        """Get appropriate productivity factor for a work package"""
        # Simple keyword matching - could be enhanced with ML
        for keyword, factor in factors.items():
            if keyword.lower() in wp_name:
                return factor
        
        return factors.get('default', Decimal('1.0'))
    
    def _validate_manual_estimate(self, project_id: UUID, estimate: Decimal, 
                                justification: str) -> ValidationResult:
        """Validate manual ETC estimate"""
        errors = []
        warnings = []
        recommendations = []
        
        if estimate <= 0:
            errors.append("Manual estimate must be positive")
        
        if len(justification.strip()) < 10:
            warnings.append("Justification should be more detailed")
        
        if estimate > Decimal('10000000'):  # 10M threshold
            warnings.append("Very large estimate - please verify")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            recommendations=recommendations
        )