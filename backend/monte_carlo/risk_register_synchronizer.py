"""
Risk Register Update Synchronization Module for Monte Carlo Risk Simulations.

This module provides functionality for change detection, automatic simulation updates,
and bidirectional risk register updates to keep simulations synchronized with
the source risk register.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass, field
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

from config.database import supabase
from .models import Risk, SimulationResults, ValidationResult
from .risk_register_integration import RiskRegisterImporter, ChangeDetectionResult
from .engine import MonteCarloEngine

logger = logging.getLogger(__name__)


@dataclass
class SynchronizationConfig:
    """Configuration for risk register synchronization."""
    auto_sync_enabled: bool = True
    sync_interval_minutes: int = 30
    max_concurrent_syncs: int = 3
    change_detection_threshold: float = 0.1  # Minimum change to trigger sync
    simulation_update_timeout: int = 300  # seconds
    retry_attempts: int = 3
    retry_delay_seconds: int = 60


@dataclass
class SyncStatus:
    """Status of synchronization for a project."""
    project_id: str
    last_sync_timestamp: datetime
    last_change_detection: datetime
    pending_changes: int
    sync_in_progress: bool
    last_error: Optional[str] = None
    consecutive_failures: int = 0
    next_scheduled_sync: Optional[datetime] = None


@dataclass
class SyncResult:
    """Result of a synchronization operation."""
    project_id: str
    success: bool
    changes_detected: int
    simulations_updated: int
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    sync_duration: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)


class RiskRegisterSynchronizer:
    """
    Handles automatic synchronization between risk register and Monte Carlo simulations.
    
    Provides change detection, automatic simulation updates, and bidirectional
    synchronization to keep simulations current with risk register changes.
    """
    
    def __init__(self, config: Optional[SynchronizationConfig] = None):
        """
        Initialize the risk register synchronizer.
        
        Args:
            config: Optional synchronization configuration
        """
        self.config = config or SynchronizationConfig()
        self.importer = RiskRegisterImporter()
        self.engine = MonteCarloEngine()
        
        # Synchronization state
        self._sync_status: Dict[str, SyncStatus] = {}
        self._active_syncs: Set[str] = set()
        self._sync_lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=self.config.max_concurrent_syncs)
        
        # Change detection cache
        self._change_detection_cache: Dict[str, ChangeDetectionResult] = {}
        
        # Simulation tracking
        self._active_simulations: Dict[str, str] = {}  # project_id -> simulation_id
        
        # Background sync task
        self._sync_task: Optional[asyncio.Task] = None
        self._shutdown_event = threading.Event()
    
    def start_background_sync(self):
        """Start background synchronization process."""
        if self.config.auto_sync_enabled and self._sync_task is None:
            logger.info("Starting background risk register synchronization")
            self._sync_task = asyncio.create_task(self._background_sync_loop())
    
    def stop_background_sync(self):
        """Stop background synchronization process."""
        if self._sync_task:
            logger.info("Stopping background risk register synchronization")
            self._shutdown_event.set()
            self._sync_task.cancel()
            self._sync_task = None
    
    def sync_project(
        self,
        project_id: str,
        force_update: bool = False,
        update_simulations: bool = True
    ) -> SyncResult:
        """
        Synchronize a specific project's risk register with Monte Carlo simulations.
        
        Args:
            project_id: ID of the project to synchronize
            force_update: Force update even if no changes detected
            update_simulations: Whether to update existing simulations
            
        Returns:
            SyncResult with synchronization details
        """
        start_time = datetime.now()
        sync_result = SyncResult(project_id=project_id, success=False)
        
        try:
            # Check if sync is already in progress
            with self._sync_lock:
                if project_id in self._active_syncs:
                    sync_result.errors.append("Synchronization already in progress for this project")
                    return sync_result
                
                self._active_syncs.add(project_id)
            
            try:
                # Update sync status
                self._update_sync_status(project_id, sync_in_progress=True)
                
                # Detect changes in risk register
                change_result = self._detect_risk_register_changes(project_id)
                sync_result.changes_detected = (
                    len(change_result.added_risks) + 
                    len(change_result.removed_risks) + 
                    len(change_result.modified_risks)
                )
                
                # Check if update is needed
                if not force_update and not change_result.has_changes:
                    logger.info(f"No changes detected for project {project_id}")
                    sync_result.success = True
                    return sync_result
                
                # Import updated risk data
                import_result = self.importer.import_risks_from_register(project_id)
                
                if not import_result.success:
                    sync_result.errors.extend([
                        f"Failed to import risks: {error.get('error', 'Unknown error')}"
                        for error in import_result.failed_imports
                    ])
                    return sync_result
                
                # Update existing simulations if requested
                if update_simulations:
                    updated_simulations = self._update_existing_simulations(
                        project_id, import_result.imported_risks, change_result
                    )
                    sync_result.simulations_updated = updated_simulations
                
                # Update bidirectional sync - push simulation insights back to register
                self._update_risk_register_with_insights(project_id)
                
                # Cache change detection result
                self._change_detection_cache[project_id] = change_result
                
                # Update sync status
                self._update_sync_status(
                    project_id,
                    sync_in_progress=False,
                    last_sync_timestamp=datetime.now(),
                    pending_changes=0,
                    consecutive_failures=0
                )
                
                sync_result.success = True
                logger.info(f"Successfully synchronized project {project_id}")
                
            finally:
                with self._sync_lock:
                    self._active_syncs.discard(project_id)
        
        except Exception as e:
            logger.error(f"Synchronization failed for project {project_id}: {str(e)}")
            sync_result.errors.append(str(e))
            
            # Update failure status
            self._update_sync_status(
                project_id,
                sync_in_progress=False,
                last_error=str(e),
                consecutive_failures=self._get_sync_status(project_id).consecutive_failures + 1
            )
        
        finally:
            sync_result.sync_duration = (datetime.now() - start_time).total_seconds()
        
        return sync_result
    
    def register_simulation(
        self,
        project_id: str,
        simulation_id: str,
        auto_update: bool = True
    ):
        """
        Register a simulation for automatic updates when risk register changes.
        
        Args:
            project_id: ID of the project
            simulation_id: ID of the simulation
            auto_update: Whether to automatically update this simulation
        """
        if auto_update:
            self._active_simulations[project_id] = simulation_id
            logger.info(f"Registered simulation {simulation_id} for auto-update on project {project_id}")
    
    def unregister_simulation(self, project_id: str):
        """
        Unregister a simulation from automatic updates.
        
        Args:
            project_id: ID of the project
        """
        if project_id in self._active_simulations:
            simulation_id = self._active_simulations.pop(project_id)
            logger.info(f"Unregistered simulation {simulation_id} from auto-update on project {project_id}")
    
    def get_sync_status(self, project_id: str) -> SyncStatus:
        """
        Get synchronization status for a project.
        
        Args:
            project_id: ID of the project
            
        Returns:
            SyncStatus for the project
        """
        return self._get_sync_status(project_id)
    
    def force_sync_all_projects(self) -> Dict[str, SyncResult]:
        """
        Force synchronization for all projects with active simulations.
        
        Returns:
            Dictionary mapping project IDs to sync results
        """
        results = {}
        
        # Get all projects with active simulations
        project_ids = list(self._active_simulations.keys())
        
        # Also include projects with recent sync status
        for project_id in self._sync_status.keys():
            if project_id not in project_ids:
                project_ids.append(project_id)
        
        # Sync each project
        for project_id in project_ids:
            try:
                result = self.sync_project(project_id, force_update=True)
                results[project_id] = result
            except Exception as e:
                logger.error(f"Failed to sync project {project_id}: {str(e)}")
                results[project_id] = SyncResult(
                    project_id=project_id,
                    success=False,
                    changes_detected=0,
                    simulations_updated=0,
                    errors=[str(e)]
                )
        
        return results
    
    def add_new_risk_to_register(
        self,
        project_id: str,
        risk_data: Dict[str, Any],
        simulation_source: bool = True
    ) -> bool:
        """
        Add a new risk to the unified registers table (type='risk').
        
        Args:
            project_id: ID of the project
            risk_data: Risk data to add
            simulation_source: Whether this risk was identified during simulation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if supabase is None:
                logger.error("Database service unavailable")
                return False
            
            # Resolve organization_id from project
            proj = (
                supabase.table("projects")
                .select("organization_id")
                .eq("id", project_id)
                .limit(1)
                .execute()
            )
            if not proj.data or len(proj.data) == 0:
                logger.error(f"Project {project_id} not found for register insert")
                return False
            org_id = proj.data[0].get("organization_id")
            if not org_id:
                logger.error(f"Project {project_id} has no organization_id")
                return False
            
            description = risk_data.get("description", "Risk identified through Monte Carlo analysis")
            if simulation_source:
                description += f" (Identified via Monte Carlo simulation on {datetime.now().isoformat()})"
            
            data = {
                "title": risk_data.get("title", "Risk identified during simulation"),
                "description": description,
                "category": risk_data.get("category", "technical"),
                "probability": risk_data.get("probability", 0.5),
                "impact": risk_data.get("impact", 0.5),
                "mitigation": risk_data.get("mitigation"),
                "owner_id": risk_data.get("owner_id"),
            }
            
            row = {
                "type": "risk",
                "project_id": project_id,
                "organization_id": str(org_id),
                "data": data,
                "status": "identified",
            }
            response = supabase.table("registers").insert(row).execute()
            
            if response.data:
                logger.info(f"Added new risk to register for project {project_id}: {data['title']}")
                if self.config.auto_sync_enabled:
                    self._schedule_immediate_sync(project_id)
                return True
            logger.error(f"Failed to add risk to register: {response}")
            return False
        except Exception as e:
            logger.error(f"Failed to add risk to register: {str(e)}")
            return False
    
    def _detect_risk_register_changes(self, project_id: str) -> ChangeDetectionResult:
        """
        Detect changes in the risk register for a project.
        
        Args:
            project_id: ID of the project
            
        Returns:
            ChangeDetectionResult with detected changes
        """
        try:
            # Get last sync timestamp
            sync_status = self._get_sync_status(project_id)
            last_sync = sync_status.last_sync_timestamp
            
            # Detect changes since last sync
            change_result = self.importer.detect_changes(project_id, last_sync)
            
            # Update change detection timestamp
            self._update_sync_status(
                project_id,
                last_change_detection=datetime.now(),
                pending_changes=len(change_result.added_risks) + 
                              len(change_result.removed_risks) + 
                              len(change_result.modified_risks)
            )
            
            return change_result
            
        except Exception as e:
            logger.error(f"Failed to detect changes for project {project_id}: {str(e)}")
            # Return empty change result on error
            return ChangeDetectionResult(
                has_changes=False,
                added_risks=[],
                removed_risks=[],
                modified_risks=[],
                change_details={}
            )
    
    def _update_existing_simulations(
        self,
        project_id: str,
        updated_risks: List[Risk],
        change_result: ChangeDetectionResult
    ) -> int:
        """
        Update existing simulations with new risk data.
        
        Args:
            project_id: ID of the project
            updated_risks: Updated list of risks
            change_result: Change detection result
            
        Returns:
            Number of simulations updated
        """
        updated_count = 0
        
        try:
            # Check if there's an active simulation for this project
            if project_id not in self._active_simulations:
                logger.info(f"No active simulation registered for project {project_id}")
                return 0
            
            simulation_id = self._active_simulations[project_id]
            
            # Get cached simulation results
            cached_results = self.engine.get_cached_results(simulation_id)
            if not cached_results:
                logger.info(f"No cached results found for simulation {simulation_id}")
                return 0
            
            # Check if changes are significant enough to warrant re-simulation
            if not self._should_update_simulation(change_result):
                logger.info(f"Changes not significant enough to update simulation {simulation_id}")
                return 0
            
            # Invalidate cache for modified risks
            for risk_id in change_result.modified_risks:
                self.engine.invalidate_cache_for_risk(risk_id)
            
            # Re-run simulation with updated risks
            logger.info(f"Re-running simulation {simulation_id} with updated risks")
            
            # Use the same parameters as the original simulation
            new_results = self.engine.run_simulation(
                risks=updated_risks,
                iterations=cached_results.iteration_count,
                # Note: Would need to store and retrieve original parameters
                # This is a simplified version
            )
            
            if new_results:
                updated_count = 1
                logger.info(f"Successfully updated simulation {simulation_id}")
            
        except Exception as e:
            logger.error(f"Failed to update simulations for project {project_id}: {str(e)}")
        
        return updated_count
    
    def _update_risk_register_with_insights(self, project_id: str):
        """
        Update risk register with insights from simulation results (bidirectional sync).
        
        Args:
            project_id: ID of the project
        """
        try:
            # Check if there's an active simulation
            if project_id not in self._active_simulations:
                return
            
            simulation_id = self._active_simulations[project_id]
            cached_results = self.engine.get_cached_results(simulation_id)
            
            if not cached_results:
                return
            
            # Calculate risk contributions and insights
            risk_contributions = {}
            for risk_id, contributions in cached_results.risk_contributions.items():
                # Calculate average contribution
                avg_contribution = float(contributions.mean()) if len(contributions) > 0 else 0.0
                risk_contributions[risk_id] = avg_contribution
            
            # Update risk register with simulation insights
            simulation_results = {
                'total_cost_p50': float(cached_results.cost_outcomes.mean()),
                'total_cost_p90': float(cached_results.cost_outcomes[int(len(cached_results.cost_outcomes) * 0.9)]),
                'total_schedule_p50': float(cached_results.schedule_outcomes.mean()),
                'total_schedule_p90': float(cached_results.schedule_outcomes[int(len(cached_results.schedule_outcomes) * 0.9)]),
                'simulation_timestamp': cached_results.timestamp.isoformat()
            }
            
            # Use importer to update risk register
            self.importer.update_risk_register_from_simulation(
                project_id=project_id,
                simulation_results=simulation_results,
                risk_contributions=risk_contributions
            )
            
            logger.info(f"Updated risk register with simulation insights for project {project_id}")
            
        except Exception as e:
            logger.error(f"Failed to update risk register with insights for project {project_id}: {str(e)}")
    
    def _should_update_simulation(self, change_result: ChangeDetectionResult) -> bool:
        """
        Determine if changes are significant enough to warrant simulation update.
        
        Args:
            change_result: Change detection result
            
        Returns:
            True if simulation should be updated
        """
        # Always update if risks are added or removed
        if change_result.added_risks or change_result.removed_risks:
            return True
        
        # Check if modifications are significant
        significant_changes = 0
        for risk_id, changes in change_result.change_details.items():
            # Check for significant probability or impact changes
            if 'probability' in changes:
                prob_change = abs(changes['probability']['current'] - changes['probability']['previous'])
                if prob_change >= self.config.change_detection_threshold:
                    significant_changes += 1
            
            if 'impact' in changes:
                impact_change = abs(changes['impact']['current'] - changes['impact']['previous'])
                if impact_change >= self.config.change_detection_threshold:
                    significant_changes += 1
        
        # Update if at least one significant change
        return significant_changes > 0
    
    def _get_sync_status(self, project_id: str) -> SyncStatus:
        """Get or create sync status for a project."""
        if project_id not in self._sync_status:
            self._sync_status[project_id] = SyncStatus(
                project_id=project_id,
                last_sync_timestamp=datetime.now() - timedelta(days=1),  # Default to 1 day ago
                last_change_detection=datetime.now() - timedelta(days=1),
                pending_changes=0,
                sync_in_progress=False
            )
        
        return self._sync_status[project_id]
    
    def _update_sync_status(self, project_id: str, **kwargs):
        """Update sync status for a project."""
        status = self._get_sync_status(project_id)
        
        for key, value in kwargs.items():
            if hasattr(status, key):
                setattr(status, key, value)
        
        self._sync_status[project_id] = status
    
    def _schedule_immediate_sync(self, project_id: str):
        """Schedule immediate synchronization for a project."""
        if self.config.auto_sync_enabled:
            # Submit sync task to executor
            future = self._executor.submit(self.sync_project, project_id, False, True)
            logger.info(f"Scheduled immediate sync for project {project_id}")
    
    async def _background_sync_loop(self):
        """Background synchronization loop."""
        logger.info("Starting background synchronization loop")
        
        while not self._shutdown_event.is_set():
            try:
                # Check each project for sync needs
                for project_id in list(self._active_simulations.keys()):
                    if self._shutdown_event.is_set():
                        break
                    
                    sync_status = self._get_sync_status(project_id)
                    
                    # Check if sync is needed
                    time_since_last_sync = datetime.now() - sync_status.last_sync_timestamp
                    sync_interval = timedelta(minutes=self.config.sync_interval_minutes)
                    
                    if (time_since_last_sync >= sync_interval and 
                        not sync_status.sync_in_progress and
                        sync_status.consecutive_failures < self.config.retry_attempts):
                        
                        # Submit sync task
                        future = self._executor.submit(self.sync_project, project_id)
                        logger.debug(f"Submitted background sync for project {project_id}")
                
                # Wait before next check
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                logger.info("Background sync loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in background sync loop: {str(e)}")
                await asyncio.sleep(60)  # Wait before retrying
        
        logger.info("Background synchronization loop stopped")
    
    def __del__(self):
        """Cleanup on destruction."""
        self.stop_background_sync()
        if hasattr(self, '_executor'):
            self._executor.shutdown(wait=True)