"""
Rundown Profile Generator Service
Generates contingency rundown profiles for projects

This service calculates:
1. Planned profile: Linear budget distribution over project duration
2. Actual profile: Adjusts planned based on commitments and actuals
3. Predicted profile: Uses linear regression for future projections
"""

import uuid
import logging
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Optional, Tuple, Any
from decimal import Decimal, ROUND_HALF_UP

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    
from supabase import Client

logger = logging.getLogger(__name__)


class RundownGeneratorError(Exception):
    """Custom exception for rundown generation errors"""
    pass


class RundownGenerator:
    """
    Generates rundown profiles for project budget tracking.
    
    Features:
    - Linear budget distribution for planned profiles
    - Actual profile calculation from commitments/actuals
    - AI predictions using linear regression
    - Multi-scenario support
    """
    
    def __init__(self, supabase_client: Client):
        """
        Initialize the generator with Supabase client.
        
        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client
        self.execution_id = str(uuid.uuid4())
        
    async def generate(
        self,
        project_id: Optional[str] = None,
        profile_types: Optional[List[str]] = None,
        scenario_name: str = "baseline",
        include_predictions: bool = True
    ) -> Dict[str, Any]:
        """
        Generate rundown profiles for one or all projects.
        
        Args:
            project_id: Optional specific project ID (None = all projects)
            profile_types: Types to generate ['standard', 'optimistic', 'pessimistic']
            scenario_name: Name of the scenario
            include_predictions: Whether to calculate AI predictions
            
        Returns:
            Generation result with statistics
        """
        start_time = datetime.utcnow()
        self.execution_id = str(uuid.uuid4())
        
        if profile_types is None:
            profile_types = ["standard"]
            
        # Log execution start
        await self._log_execution(
            status="started",
            message=f"Starting profile generation for {'all projects' if not project_id else project_id}"
        )
        
        projects_processed = 0
        profiles_created = 0
        errors: List[Dict[str, Any]] = []
        
        try:
            # Fetch projects
            if project_id:
                projects = await self._fetch_project(project_id)
            else:
                projects = await self._fetch_all_projects()
                
            if not projects:
                logger.warning("No projects found for profile generation")
                return self._create_result(
                    start_time, projects_processed, profiles_created, errors, "completed"
                )
            
            # Process each project
            for project in projects:
                try:
                    count = await self._generate_project_profiles(
                        project,
                        profile_types,
                        scenario_name,
                        include_predictions
                    )
                    profiles_created += count
                    projects_processed += 1
                    
                except Exception as e:
                    error_info = {
                        "project_id": project.get("id"),
                        "project_name": project.get("name"),
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    errors.append(error_info)
                    logger.error(f"Error generating profiles for project {project.get('id')}: {e}")
                    continue
                    
            # Determine final status
            if errors:
                status = "partial" if profiles_created > 0 else "failed"
            else:
                status = "completed"
                
            # Log completion
            result = self._create_result(start_time, projects_processed, profiles_created, errors, status)
            await self._log_execution(
                status=status,
                message=f"Completed: {projects_processed} projects, {profiles_created} profiles",
                projects_processed=projects_processed,
                profiles_created=profiles_created,
                errors_count=len(errors),
                execution_time_ms=result["execution_time_ms"]
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Critical error in profile generation: {e}")
            await self._log_execution(
                status="failed",
                message=str(e),
                errors_count=1
            )
            raise RundownGeneratorError(f"Profile generation failed: {e}")
    
    async def _generate_project_profiles(
        self,
        project: Dict[str, Any],
        profile_types: List[str],
        scenario_name: str,
        include_predictions: bool
    ) -> int:
        """
        Generate profiles for a single project.
        
        Args:
            project: Project data dictionary
            profile_types: Types to generate
            scenario_name: Scenario name
            include_predictions: Whether to include predictions
            
        Returns:
            Number of profiles created
        """
        project_id = project["id"]
        budget = Decimal(str(project.get("budget", 0)))
        start_date = self._parse_date(project.get("start_date"))
        end_date = self._parse_date(project.get("end_date"))
        
        if not start_date or not end_date:
            raise RundownGeneratorError(f"Project {project_id} has invalid dates")
            
        if budget <= 0:
            logger.warning(f"Project {project_id} has zero or negative budget, skipping")
            return 0
            
        # Get months between start and end
        months = self._get_months_between(start_date, end_date)
        if not months:
            raise RundownGeneratorError(f"Project {project_id} has no valid months")
            
        profiles_created = 0
        
        for profile_type in profile_types:
            # Calculate planned profile
            planned_profiles = self._calculate_planned_profile(
                project_id, budget, months, profile_type, scenario_name
            )
            
            # Calculate actual profile (adjust planned based on actuals)
            actual_profiles = await self._calculate_actual_profile(
                project_id, planned_profiles, scenario_name
            )
            
            # Calculate predictions if requested
            if include_predictions and NUMPY_AVAILABLE:
                actual_profiles = self._calculate_predictions(
                    actual_profiles, months
                )
            
            # Upsert profiles to database
            for profile in actual_profiles:
                await self._upsert_profile(profile)
                profiles_created += 1
                
        return profiles_created
    
    def _calculate_planned_profile(
        self,
        project_id: str,
        budget: Decimal,
        months: List[str],
        profile_type: str,
        scenario_name: str
    ) -> List[Dict[str, Any]]:
        """
        Calculate planned profile with linear budget distribution.
        
        The budget is distributed evenly across all months, with each
        month's value being cumulative.
        
        Args:
            project_id: Project ID
            budget: Total budget
            months: List of months in YYYYMM format
            profile_type: Profile type variant
            scenario_name: Scenario name
            
        Returns:
            List of profile dictionaries
        """
        total_months = len(months)
        if total_months == 0:
            return []
            
        # Monthly increment (linear distribution)
        monthly_increment = budget / Decimal(total_months)
        
        # Apply adjustment for optimistic/pessimistic profiles
        if profile_type == "optimistic":
            monthly_increment = monthly_increment * Decimal("0.9")  # 10% under budget
        elif profile_type == "pessimistic":
            monthly_increment = monthly_increment * Decimal("1.1")  # 10% over budget
            
        profiles = []
        cumulative_value = Decimal("0")
        
        for month in months:
            cumulative_value += monthly_increment
            # Round to 2 decimal places
            planned_value = cumulative_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            profiles.append({
                "project_id": project_id,
                "month": month,
                "planned_value": float(planned_value),
                "actual_value": float(planned_value),  # Initially same as planned
                "predicted_value": None,
                "profile_type": profile_type,
                "scenario_name": scenario_name
            })
            
        return profiles
    
    async def _calculate_actual_profile(
        self,
        project_id: str,
        planned_profiles: List[Dict[str, Any]],
        scenario_name: str
    ) -> List[Dict[str, Any]]:
        """
        Calculate actual profile by adjusting planned values based on
        actual commitments and actuals from the database.
        
        Args:
            project_id: Project ID
            planned_profiles: Base planned profiles
            scenario_name: Scenario name
            
        Returns:
            Adjusted profiles with actual values
        """
        # Get budget changes from commitments and actuals
        budget_changes = await self._get_budget_changes(project_id)
        
        if not budget_changes:
            return planned_profiles
            
        # Create a copy of profiles
        profiles = [dict(p) for p in planned_profiles]
        
        # Apply changes from their effective month onwards
        for change in budget_changes:
            change_month = change["month"]
            change_amount = Decimal(str(change["amount"]))
            
            # Find the index of the change month
            change_idx = None
            for idx, profile in enumerate(profiles):
                if profile["month"] >= change_month:
                    if change_idx is None:
                        change_idx = idx
                    # Add the change amount to all subsequent months
                    current_actual = Decimal(str(profile["actual_value"]))
                    profile["actual_value"] = float(
                        (current_actual + change_amount).quantize(
                            Decimal("0.01"), rounding=ROUND_HALF_UP
                        )
                    )
                    
        return profiles
    
    async def _get_budget_changes(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get aggregated budget changes from commitments and actuals.
        
        Args:
            project_id: Project ID
            
        Returns:
            List of changes with month and amount
        """
        try:
            # Fetch commitments
            commitments_response = self.supabase.table("commitments").select(
                "amount, commitment_date"
            ).eq("project_id", project_id).execute()
            
            # Fetch actuals
            actuals_response = self.supabase.table("actuals").select(
                "amount, actual_date"
            ).eq("project_id", project_id).execute()
            
            changes = []
            
            # Process commitments
            for commitment in (commitments_response.data or []):
                if commitment.get("commitment_date") and commitment.get("amount"):
                    month = self._date_to_month(commitment["commitment_date"])
                    if month:
                        changes.append({
                            "month": month,
                            "amount": commitment["amount"],
                            "type": "commitment"
                        })
                        
            # Process actuals (these represent actual spend adjustments)
            for actual in (actuals_response.data or []):
                if actual.get("actual_date") and actual.get("amount"):
                    month = self._date_to_month(actual["actual_date"])
                    if month:
                        changes.append({
                            "month": month,
                            "amount": actual["amount"],
                            "type": "actual"
                        })
                        
            # Sort by month
            changes.sort(key=lambda x: x["month"])
            
            return changes
            
        except Exception as e:
            logger.warning(f"Failed to fetch budget changes for project {project_id}: {e}")
            return []
    
    def _calculate_predictions(
        self,
        profiles: List[Dict[str, Any]],
        all_months: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Calculate AI predictions using linear regression on historical data.
        
        Uses the last 6 months of actual data to predict future values.
        
        Args:
            profiles: Existing profiles with actual values
            all_months: All months for the project
            
        Returns:
            Profiles with predicted values for future months
        """
        if not NUMPY_AVAILABLE:
            logger.warning("NumPy not available, skipping predictions")
            return profiles
            
        current_month = datetime.utcnow().strftime("%Y%m")
        
        # Separate historical and future profiles
        historical = [p for p in profiles if p["month"] <= current_month]
        
        if len(historical) < 3:
            # Not enough data for regression
            return profiles
            
        # Use last 6 months for regression (or all if less than 6)
        regression_data = historical[-6:]
        
        # Prepare data for regression
        x = np.array(range(len(regression_data))).reshape(-1, 1)
        y = np.array([p["actual_value"] for p in regression_data])
        
        # Simple linear regression
        x_mean = np.mean(x)
        y_mean = np.mean(y)
        
        numerator = np.sum((x.flatten() - x_mean) * (y - y_mean))
        denominator = np.sum((x.flatten() - x_mean) ** 2)
        
        if denominator == 0:
            return profiles
            
        slope = numerator / denominator
        intercept = y_mean - slope * x_mean
        
        # Calculate predictions for future months
        start_idx = len(regression_data)
        for profile in profiles:
            if profile["month"] > current_month:
                # Find the index for this month
                try:
                    month_idx = all_months.index(profile["month"])
                    prediction_idx = start_idx + (month_idx - len(historical))
                    predicted = intercept + slope * prediction_idx
                    profile["predicted_value"] = round(max(0, predicted), 2)
                except (ValueError, IndexError):
                    pass
                    
        return profiles
    
    async def _upsert_profile(self, profile: Dict[str, Any]) -> None:
        """
        Insert or update a profile in the database.
        
        Args:
            profile: Profile data to upsert
        """
        try:
            self.supabase.table("rundown_profiles").upsert(
                profile,
                on_conflict="project_id,month,profile_type,scenario_name"
            ).execute()
        except Exception as e:
            logger.error(f"Failed to upsert profile: {e}")
            raise
    
    async def _fetch_project(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch a single project by ID."""
        try:
            response = self.supabase.table("projects").select(
                "id, name, budget, start_date, end_date"
            ).eq("id", project_id).execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to fetch project {project_id}: {e}")
            return []
    
    async def _fetch_all_projects(self) -> List[Dict[str, Any]]:
        """Fetch all active projects."""
        try:
            response = self.supabase.table("projects").select(
                "id, name, budget, start_date, end_date"
            ).eq("status", "active").execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to fetch projects: {e}")
            return []
    
    async def _log_execution(
        self,
        status: str,
        message: str = None,
        projects_processed: int = 0,
        profiles_created: int = 0,
        errors_count: int = 0,
        execution_time_ms: int = None
    ) -> None:
        """Log execution to the generation logs table."""
        try:
            log_entry = {
                "execution_id": self.execution_id,
                "status": status,
                "message": message,
                "projects_processed": projects_processed,
                "profiles_created": profiles_created,
                "errors_count": errors_count,
                "execution_time_ms": execution_time_ms
            }
            self.supabase.table("rundown_generation_logs").insert(log_entry).execute()
        except Exception as e:
            logger.warning(f"Failed to log execution: {e}")
    
    def _get_months_between(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[str]:
        """
        Get list of months between two dates in YYYYMM format.
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            List of month strings in YYYYMM format
        """
        months = []
        current = start_date.replace(day=1)
        end = end_date.replace(day=1)
        
        while current <= end:
            months.append(current.strftime("%Y%m"))
            current = current + relativedelta(months=1)
            
        return months
    
    def _parse_date(self, date_value: Any) -> Optional[datetime]:
        """Parse a date value from various formats."""
        if date_value is None:
            return None
            
        if isinstance(date_value, datetime):
            return date_value
            
        if isinstance(date_value, str):
            try:
                # Try ISO format first
                return datetime.fromisoformat(date_value.replace("Z", "+00:00"))
            except ValueError:
                pass
            try:
                # Try common date format
                return datetime.strptime(date_value, "%Y-%m-%d")
            except ValueError:
                pass
                
        return None
    
    def _date_to_month(self, date_value: Any) -> Optional[str]:
        """Convert a date to YYYYMM format."""
        parsed = self._parse_date(date_value)
        if parsed:
            return parsed.strftime("%Y%m")
        return None
    
    def _create_result(
        self,
        start_time: datetime,
        projects_processed: int,
        profiles_created: int,
        errors: List[Dict[str, Any]],
        status: str
    ) -> Dict[str, Any]:
        """Create the generation result dictionary."""
        execution_time = datetime.utcnow() - start_time
        execution_time_ms = int(execution_time.total_seconds() * 1000)
        
        return {
            "execution_id": self.execution_id,
            "status": status,
            "projects_processed": projects_processed,
            "profiles_created": profiles_created,
            "errors_count": len(errors),
            "execution_time_ms": execution_time_ms,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }


# Singleton instance holder
_generator_instance: Optional[RundownGenerator] = None


def get_rundown_generator(supabase_client: Client) -> RundownGenerator:
    """Get or create the RundownGenerator instance."""
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = RundownGenerator(supabase_client)
    return _generator_instance
