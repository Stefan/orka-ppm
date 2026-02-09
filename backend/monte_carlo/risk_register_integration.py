"""
Risk Register Integration Module for Monte Carlo Risk Simulations.

This module provides functionality to automatically import risk data from existing systems,
validate and transform the data, and maintain traceability between simulation results
and source risk register entries.
"""

import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
import logging

from config.database import supabase
from .models import (
    Risk, RiskCategory, ImpactType, ProbabilityDistribution, 
    DistributionType, ValidationResult, RiskData
)
from models.risks import RiskCategory as APIRiskCategory, RiskStatus

logger = logging.getLogger(__name__)


@dataclass
class RiskRegisterEntry:
    """Represents a risk entry from the risk register."""
    id: str
    project_id: str
    title: str
    description: Optional[str]
    category: str
    probability: float  # 0.0 to 1.0
    impact: float  # 0.0 to 1.0
    status: str
    mitigation: Optional[str]
    owner_id: Optional[str]
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Additional fields for Monte Carlo integration
    baseline_impact_cost: Optional[float] = None
    baseline_impact_schedule: Optional[float] = None
    distribution_type: Optional[str] = None
    distribution_parameters: Dict[str, float] = field(default_factory=dict)
    correlation_dependencies: List[str] = field(default_factory=list)


@dataclass
class ImportResult:
    """Result of risk register import operation."""
    success: bool
    imported_risks: List[Risk]
    failed_imports: List[Dict[str, Any]]
    warnings: List[str]
    traceability_map: Dict[str, str]  # risk_register_id -> monte_carlo_risk_id
    import_timestamp: datetime
    source_system: str


@dataclass
class ChangeDetectionResult:
    """Result of change detection between risk register and cached data."""
    has_changes: bool
    added_risks: List[str]
    removed_risks: List[str]
    modified_risks: List[str]
    change_details: Dict[str, Dict[str, Any]]


class RiskRegisterImporter:
    """
    Handles automatic risk data import from existing risk register systems.
    
    Provides functionality to import risk data, validate and transform it for
    Monte Carlo simulation, and maintain traceability between results and
    source entries.
    """
    
    def __init__(self):
        """Initialize the risk register importer."""
        self._import_cache: Dict[str, ImportResult] = {}
        self._change_detection_cache: Dict[str, Dict[str, Any]] = {}
    
    def import_risks_from_register(
        self,
        project_id: str,
        include_closed: bool = False,
        baseline_costs: Optional[Dict[str, float]] = None,
        baseline_schedule: Optional[Dict[str, float]] = None
    ) -> ImportResult:
        """
        Import risk data from the existing risk register for a specific project.
        
        Args:
            project_id: ID of the project to import risks for
            include_closed: Whether to include closed/resolved risks
            baseline_costs: Optional baseline cost data for impact calculation
            baseline_schedule: Optional baseline schedule data for impact calculation
            
        Returns:
            ImportResult containing imported risks and metadata
            
        Raises:
            ValueError: If project_id is invalid
            RuntimeError: If database connection fails
        """
        if not project_id:
            raise ValueError("Project ID cannot be empty")
        
        try:
            # Query risk register for project risks
            risk_entries = self._fetch_risk_register_data(project_id, include_closed)
            
            # Transform risk register entries to Monte Carlo Risk objects
            imported_risks = []
            failed_imports = []
            warnings = []
            traceability_map = {}
            
            for entry in risk_entries:
                try:
                    # Transform risk register entry to Monte Carlo Risk
                    monte_carlo_risk = self._transform_risk_entry(
                        entry, baseline_costs, baseline_schedule
                    )
                    
                    # Validate the transformed risk
                    validation_result = self._validate_transformed_risk(monte_carlo_risk)
                    if validation_result.is_valid:
                        imported_risks.append(monte_carlo_risk)
                        traceability_map[entry.id] = monte_carlo_risk.id
                    else:
                        failed_imports.append({
                            'risk_register_id': entry.id,
                            'title': entry.title,
                            'errors': validation_result.errors,
                            'warnings': validation_result.warnings
                        })
                        warnings.extend(validation_result.warnings)
                
                except Exception as e:
                    logger.error(f"Failed to transform risk {entry.id}: {str(e)}")
                    failed_imports.append({
                        'risk_register_id': entry.id,
                        'title': entry.title,
                        'error': str(e)
                    })
            
            # Create import result
            import_result = ImportResult(
                success=len(imported_risks) > 0,
                imported_risks=imported_risks,
                failed_imports=failed_imports,
                warnings=warnings,
                traceability_map=traceability_map,
                import_timestamp=datetime.now(),
                source_system="risk_register"
            )
            
            # Cache the import result for change detection
            self._import_cache[project_id] = import_result
            
            return import_result
            
        except Exception as e:
            logger.error(f"Failed to import risks for project {project_id}: {str(e)}")
            raise RuntimeError(f"Risk register import failed: {str(e)}") from e
    
    def detect_changes(
        self,
        project_id: str,
        previous_import_timestamp: Optional[datetime] = None
    ) -> ChangeDetectionResult:
        """
        Detect changes in the risk register since the last import.
        
        Args:
            project_id: ID of the project to check for changes
            previous_import_timestamp: Timestamp of previous import for comparison
            
        Returns:
            ChangeDetectionResult indicating what has changed
        """
        try:
            # Get current risk register state
            current_entries = self._fetch_risk_register_data(project_id, include_closed=True)
            current_risk_map = {entry.id: entry for entry in current_entries}
            
            # Get previous state from cache or database
            previous_risk_map = self._get_previous_risk_state(project_id, previous_import_timestamp)
            
            # Detect changes
            current_ids = set(current_risk_map.keys())
            previous_ids = set(previous_risk_map.keys())
            
            added_risks = list(current_ids - previous_ids)
            removed_risks = list(previous_ids - current_ids)
            common_risks = current_ids & previous_ids
            
            # Check for modifications in common risks
            modified_risks = []
            change_details = {}
            
            for risk_id in common_risks:
                current_entry = current_risk_map[risk_id]
                previous_entry = previous_risk_map[risk_id]
                
                changes = self._compare_risk_entries(current_entry, previous_entry)
                if changes:
                    modified_risks.append(risk_id)
                    change_details[risk_id] = changes
            
            # Update change detection cache
            self._change_detection_cache[project_id] = {
                'timestamp': datetime.now(),
                'risk_map': {rid: self._serialize_risk_entry(entry) 
                           for rid, entry in current_risk_map.items()}
            }
            
            return ChangeDetectionResult(
                has_changes=bool(added_risks or removed_risks or modified_risks),
                added_risks=added_risks,
                removed_risks=removed_risks,
                modified_risks=modified_risks,
                change_details=change_details
            )
            
        except Exception as e:
            logger.error(f"Failed to detect changes for project {project_id}: {str(e)}")
            raise RuntimeError(f"Change detection failed: {str(e)}") from e
    
    def get_traceability_info(
        self,
        monte_carlo_risk_id: str,
        project_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get traceability information linking Monte Carlo risk to source register entry.
        
        Args:
            monte_carlo_risk_id: ID of the Monte Carlo risk
            project_id: ID of the project
            
        Returns:
            Dictionary with traceability information or None if not found
        """
        # Check import cache for traceability mapping
        if project_id in self._import_cache:
            import_result = self._import_cache[project_id]
            
            # Find the risk register ID that maps to this Monte Carlo risk
            for register_id, mc_risk_id in import_result.traceability_map.items():
                if mc_risk_id == monte_carlo_risk_id:
                    return {
                        'risk_register_id': register_id,
                        'import_timestamp': import_result.import_timestamp,
                        'source_system': import_result.source_system,
                        'monte_carlo_risk_id': monte_carlo_risk_id
                    }
        
        return None
    
    def update_risk_register_from_simulation(
        self,
        project_id: str,
        simulation_results: Dict[str, Any],
        risk_contributions: Dict[str, float]
    ) -> bool:
        """
        Update risk register with insights from Monte Carlo simulation results.
        
        Args:
            project_id: ID of the project
            simulation_results: Results from Monte Carlo simulation
            risk_contributions: Risk contribution analysis results
            
        Returns:
            True if update was successful, False otherwise
        """
        try:
            if project_id not in self._import_cache:
                logger.warning(f"No import cache found for project {project_id}")
                return False
            
            import_result = self._import_cache[project_id]
            
            # Update each risk in the register with simulation insights
            for register_id, mc_risk_id in import_result.traceability_map.items():
                if mc_risk_id in risk_contributions:
                    contribution = risk_contributions[mc_risk_id]
                    
                    # Prepare update data for risk register
                    update_data = {
                        'simulation_contribution': contribution,
                        'last_simulation_date': datetime.now().isoformat(),
                        'simulation_percentile': self._calculate_risk_percentile(
                            contribution, risk_contributions
                        )
                    }
                    
                    # Update the risk register entry
                    self._update_risk_register_entry(register_id, update_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update risk register for project {project_id}: {str(e)}")
            return False
    
    def _fetch_risk_register_data(
        self,
        project_id: str,
        include_closed: bool = False
    ) -> List[RiskRegisterEntry]:
        """
        Fetch risk data from the unified registers table (type='risk').
        
        Args:
            project_id: ID of the project
            include_closed: Whether to include closed risks
            
        Returns:
            List of RiskRegisterEntry objects
        """
        if supabase is None:
            raise RuntimeError("Database service unavailable")
        
        try:
            query = (
                supabase.table("registers")
                .select("*")
                .eq("type", "risk")
                .eq("project_id", project_id)
            )
            if not include_closed:
                query = query.neq("status", "closed")
            response = query.order("created_at", desc=False).execute()
            
            if not response.data:
                logger.info(f"No risks found for project {project_id}")
                return []
            
            risk_entries = []
            for record in response.data:
                data = record.get("data") or {}
                raw_due = data.get("due_date") or record.get("due_date")
                due_date = None
                if raw_due:
                    try:
                        due_date = datetime.fromisoformat(str(raw_due).replace("Z", "+00:00"))
                    except (TypeError, ValueError):
                        pass
                entry = RiskRegisterEntry(
                    id=str(record["id"]),
                    project_id=str(record["project_id"]) if record.get("project_id") else project_id,
                    title=data.get("title") or data.get("name") or "Untitled risk",
                    description=data.get("description"),
                    category=data.get("category") or "technical",
                    probability=float(data.get("probability", 0.5)),
                    impact=float(data.get("impact", 0.5)),
                    status=record.get("status") or "open",
                    mitigation=data.get("mitigation"),
                    owner_id=data.get("owner_id"),
                    due_date=due_date,
                    created_at=datetime.fromisoformat(record["created_at"].replace("Z", "+00:00")),
                    updated_at=datetime.fromisoformat(record["updated_at"].replace("Z", "+00:00")),
                )
                risk_entries.append(entry)
            
            return risk_entries
            
        except Exception as e:
            logger.error(f"Failed to fetch risk register data: {str(e)}")
            raise RuntimeError(f"Database query failed: {str(e)}") from e
    
    def _transform_risk_entry(
        self,
        entry: RiskRegisterEntry,
        baseline_costs: Optional[Dict[str, float]] = None,
        baseline_schedule: Optional[Dict[str, float]] = None
    ) -> Risk:
        """
        Transform a risk register entry into a Monte Carlo Risk object.
        
        Args:
            entry: Risk register entry to transform
            baseline_costs: Optional baseline cost data
            baseline_schedule: Optional baseline schedule data
            
        Returns:
            Monte Carlo Risk object
        """
        # Map risk category from API enum to Monte Carlo enum
        category_mapping = {
            'technical': RiskCategory.TECHNICAL,
            'financial': RiskCategory.COST,
            'operational': RiskCategory.RESOURCE,
            'strategic': RiskCategory.EXTERNAL,
            'external': RiskCategory.EXTERNAL
        }
        
        monte_carlo_category = category_mapping.get(
            entry.category, RiskCategory.EXTERNAL
        )
        
        # Determine impact type based on category and available baseline data
        impact_type = self._determine_impact_type(
            entry, baseline_costs, baseline_schedule
        )
        
        # Create probability distribution from risk register data
        probability_distribution = self._create_probability_distribution(entry)
        
        # Calculate baseline impact
        baseline_impact = self._calculate_baseline_impact(
            entry, impact_type, baseline_costs, baseline_schedule
        )
        
        # Create Monte Carlo Risk object
        monte_carlo_risk = Risk(
            id=str(uuid.uuid4()),  # Generate new ID for Monte Carlo system
            name=entry.title,
            category=monte_carlo_category,
            impact_type=impact_type,
            probability_distribution=probability_distribution,
            baseline_impact=baseline_impact,
            correlation_dependencies=[],  # Will be populated separately
            mitigation_strategies=[]  # Will be populated separately
        )
        
        return monte_carlo_risk
    
    def _determine_impact_type(
        self,
        entry: RiskRegisterEntry,
        baseline_costs: Optional[Dict[str, float]],
        baseline_schedule: Optional[Dict[str, float]]
    ) -> ImpactType:
        """
        Determine the impact type for a risk based on category and available data.
        
        Args:
            entry: Risk register entry
            baseline_costs: Optional baseline cost data
            baseline_schedule: Optional baseline schedule data
            
        Returns:
            ImpactType enum value
        """
        # Category-based impact type determination
        if entry.category in ['financial']:
            return ImpactType.COST
        elif entry.category in ['technical', 'operational']:
            # Technical and operational risks often affect both cost and schedule
            if baseline_costs and baseline_schedule:
                return ImpactType.BOTH
            elif baseline_costs:
                return ImpactType.COST
            elif baseline_schedule:
                return ImpactType.SCHEDULE
            else:
                return ImpactType.BOTH  # Default for technical/operational
        else:
            # Strategic and external risks can affect both
            return ImpactType.BOTH
    
    def _create_probability_distribution(
        self,
        entry: RiskRegisterEntry
    ) -> ProbabilityDistribution:
        """
        Create a probability distribution from risk register data.
        
        Args:
            entry: Risk register entry
            
        Returns:
            ProbabilityDistribution object
        """
        # Check if custom distribution parameters are provided
        if entry.distribution_parameters and entry.distribution_type:
            try:
                dist_type = DistributionType(entry.distribution_type)
                return ProbabilityDistribution(
                    distribution_type=dist_type,
                    parameters=entry.distribution_parameters
                )
            except (ValueError, KeyError):
                # Fall back to default distribution
                pass
        
        # Create default triangular distribution from probability and impact
        # Convert probability and impact to triangular distribution parameters
        
        # Use impact as the scale for the distribution
        impact_scale = entry.impact
        
        # Create triangular distribution with:
        # - Minimum: 10% of impact (optimistic case)
        # - Mode: impact value (most likely case)
        # - Maximum: 150% of impact (pessimistic case)
        min_impact = impact_scale * 0.1
        mode_impact = impact_scale
        max_impact = impact_scale * 1.5
        
        return ProbabilityDistribution(
            distribution_type=DistributionType.TRIANGULAR,
            parameters={
                'min': min_impact,
                'mode': mode_impact,
                'max': max_impact
            }
        )
    
    def _calculate_baseline_impact(
        self,
        entry: RiskRegisterEntry,
        impact_type: ImpactType,
        baseline_costs: Optional[Dict[str, float]],
        baseline_schedule: Optional[Dict[str, float]]
    ) -> float:
        """
        Calculate baseline impact for the risk.
        
        Args:
            entry: Risk register entry
            impact_type: Type of impact (cost, schedule, both)
            baseline_costs: Optional baseline cost data
            baseline_schedule: Optional baseline schedule data
            
        Returns:
            Baseline impact value
        """
        # Base impact from risk register (0.0 to 1.0)
        base_impact = entry.impact
        
        # Scale based on available baseline data
        if impact_type == ImpactType.COST and baseline_costs:
            # Scale by total project cost
            total_baseline_cost = sum(baseline_costs.values())
            return base_impact * total_baseline_cost * 0.1  # 10% of total cost as max impact
        
        elif impact_type == ImpactType.SCHEDULE and baseline_schedule:
            # Scale by total project duration
            total_baseline_schedule = sum(baseline_schedule.values())
            return base_impact * total_baseline_schedule * 0.1  # 10% of total duration as max impact
        
        elif impact_type == ImpactType.BOTH:
            # For both types, use a normalized impact value
            if baseline_costs and baseline_schedule:
                cost_component = sum(baseline_costs.values()) * 0.05
                schedule_component = sum(baseline_schedule.values()) * 0.05
                return base_impact * (cost_component + schedule_component)
            elif baseline_costs:
                return base_impact * sum(baseline_costs.values()) * 0.1
            elif baseline_schedule:
                return base_impact * sum(baseline_schedule.values()) * 0.1
        
        # Default: use impact value directly (normalized)
        return base_impact * 100.0  # Scale to reasonable baseline
    
    def _validate_transformed_risk(self, risk: Risk) -> ValidationResult:
        """
        Validate a transformed Monte Carlo Risk object.
        
        Args:
            risk: Monte Carlo Risk object to validate
            
        Returns:
            ValidationResult indicating if the risk is valid
        """
        errors = []
        warnings = []
        recommendations = []
        
        # Validate required fields
        if not risk.id:
            errors.append("Risk ID cannot be empty")
        
        if not risk.name:
            errors.append("Risk name cannot be empty")
        
        if risk.baseline_impact <= 0:
            errors.append("Baseline impact must be positive")
        
        # Validate probability distribution
        try:
            # Test sampling from the distribution
            test_sample = risk.probability_distribution.sample(1)
            if not all(x >= 0 for x in test_sample):
                warnings.append("Probability distribution produces negative values")
        except Exception as e:
            errors.append(f"Invalid probability distribution: {str(e)}")
        
        # Recommendations
        if risk.baseline_impact > 1000000:  # Large impact
            recommendations.append("Consider reviewing baseline impact calculation for very large values")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            recommendations=recommendations
        )
    
    def _get_previous_risk_state(
        self,
        project_id: str,
        timestamp: Optional[datetime] = None
    ) -> Dict[str, RiskRegisterEntry]:
        """
        Get previous risk state for change detection.
        
        Args:
            project_id: ID of the project
            timestamp: Optional timestamp for historical comparison
            
        Returns:
            Dictionary mapping risk IDs to RiskRegisterEntry objects
        """
        # Check cache first
        if project_id in self._change_detection_cache:
            cached_data = self._change_detection_cache[project_id]
            return {
                rid: self._deserialize_risk_entry(data)
                for rid, data in cached_data['risk_map'].items()
            }
        
        # If no cache, return empty dict (first run)
        return {}
    
    def _compare_risk_entries(
        self,
        current: RiskRegisterEntry,
        previous: RiskRegisterEntry
    ) -> Dict[str, Any]:
        """
        Compare two risk entries to detect changes.
        
        Args:
            current: Current risk entry
            previous: Previous risk entry
            
        Returns:
            Dictionary of changes detected
        """
        changes = {}
        
        # Compare key fields
        fields_to_compare = [
            'title', 'description', 'category', 'probability', 
            'impact', 'status', 'mitigation', 'owner_id', 'due_date'
        ]
        
        for field in fields_to_compare:
            current_value = getattr(current, field)
            previous_value = getattr(previous, field)
            
            if current_value != previous_value:
                changes[field] = {
                    'previous': previous_value,
                    'current': current_value
                }
        
        return changes
    
    def _serialize_risk_entry(self, entry: RiskRegisterEntry) -> Dict[str, Any]:
        """Serialize a risk entry for caching."""
        return {
            'id': entry.id,
            'project_id': entry.project_id,
            'title': entry.title,
            'description': entry.description,
            'category': entry.category,
            'probability': entry.probability,
            'impact': entry.impact,
            'status': entry.status,
            'mitigation': entry.mitigation,
            'owner_id': entry.owner_id,
            'due_date': entry.due_date.isoformat() if entry.due_date else None,
            'created_at': entry.created_at.isoformat(),
            'updated_at': entry.updated_at.isoformat()
        }
    
    def _deserialize_risk_entry(self, data: Dict[str, Any]) -> RiskRegisterEntry:
        """Deserialize a risk entry from cached data."""
        return RiskRegisterEntry(
            id=data['id'],
            project_id=data['project_id'],
            title=data['title'],
            description=data['description'],
            category=data['category'],
            probability=data['probability'],
            impact=data['impact'],
            status=data['status'],
            mitigation=data['mitigation'],
            owner_id=data['owner_id'],
            due_date=datetime.fromisoformat(data['due_date']) if data['due_date'] else None,
            created_at=datetime.fromisoformat(data['created_at']),
            updated_at=datetime.fromisoformat(data['updated_at'])
        )
    
    def _calculate_risk_percentile(
        self,
        contribution: float,
        all_contributions: Dict[str, float]
    ) -> float:
        """
        Calculate the percentile rank of a risk's contribution.
        
        Args:
            contribution: The risk's contribution value
            all_contributions: All risk contributions
            
        Returns:
            Percentile rank (0.0 to 1.0)
        """
        if not all_contributions:
            return 0.0
        
        contributions_list = list(all_contributions.values())
        contributions_list.sort()
        
        # Find position of this contribution
        position = 0
        for i, value in enumerate(contributions_list):
            if value <= contribution:
                position = i + 1
        
        return position / len(contributions_list)
    
    def _update_risk_register_entry(
        self,
        risk_id: str,
        update_data: Dict[str, Any]
    ) -> bool:
        """
        Update a unified register entry (registers.data) with simulation results.
        
        Args:
            risk_id: ID of the register entry to update
            update_data: Fields to merge into data (e.g. simulation_contribution, last_simulation_date)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if supabase is None:
                logger.error("Database service unavailable")
                return False
            row = (
                supabase.table("registers")
                .select("data")
                .eq("id", risk_id)
                .limit(1)
                .execute()
            )
            if not row.data or len(row.data) == 0:
                return False
            current_data = dict(row.data[0].get("data") or {})
            current_data.update(update_data)
            response = (
                supabase.table("registers")
                .update({"data": current_data})
                .eq("id", risk_id)
                .execute()
            )
            return bool(response.data)
        except Exception as e:
            logger.error(f"Failed to update risk register entry {risk_id}: {str(e)}")
            return False


# Alias for backward compatibility (e.g. test_complete_monte_carlo_integration)
RiskRegisterIntegrator = RiskRegisterImporter