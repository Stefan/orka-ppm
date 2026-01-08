"""
Project Integration Service

Handles integration between change requests and projects, milestones, and purchase orders.
Provides bidirectional relationship management and integration with existing systems.
"""

import asyncio
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
import logging

from config.database import supabase
from models.change_management import ChangeRequestResponse

logger = logging.getLogger(__name__)

class ProjectIntegrationService:
    """
    Service for managing integration between change requests and project entities.
    
    Handles:
    - Linking to projects, milestones, and purchase orders
    - Bidirectional relationship management
    - Integration with existing project and financial systems
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def link_change_to_project(
        self,
        change_id: UUID,
        project_id: UUID,
        linked_by: UUID
    ) -> bool:
        """
        Link a change request to a project with bidirectional relationship.
        
        Args:
            change_id: ID of the change request
            project_id: ID of the project
            linked_by: ID of the user creating the link
            
        Returns:
            bool: True if successful
        """
        try:
            # Verify project exists
            project_result = self.db.table("projects").select("id, name, budget, timeline").eq("id", str(project_id)).execute()
            if not project_result.data:
                raise ValueError(f"Project {project_id} not found")
            
            project_data = project_result.data[0]
            
            # Update change request with project link
            change_update = {
                "project_id": str(project_id),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            change_result = self.db.table("change_requests").update(change_update).eq("id", str(change_id)).execute()
            
            if not change_result.data:
                return False
            
            # Create bidirectional link in project_change_links table (if exists)
            try:
                link_data = {
                    "project_id": str(project_id),
                    "change_request_id": str(change_id),
                    "linked_by": str(linked_by),
                    "linked_at": datetime.utcnow().isoformat(),
                    "link_type": "primary"
                }
                
                # Check if table exists and insert
                self.db.table("project_change_links").insert(link_data).execute()
            except Exception as e:
                logger.warning(f"Could not create bidirectional link (table may not exist): {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error linking change {change_id} to project {project_id}: {e}")
            return False
    
    async def link_change_to_milestones(
        self,
        change_id: UUID,
        milestone_ids: List[UUID],
        linked_by: UUID
    ) -> bool:
        """
        Link a change request to project milestones.
        
        Args:
            change_id: ID of the change request
            milestone_ids: List of milestone IDs
            linked_by: ID of the user creating the links
            
        Returns:
            bool: True if successful
        """
        try:
            # Verify milestones exist
            milestone_results = self.db.table("project_milestones").select("id, name, target_date").in_("id", [str(m) for m in milestone_ids]).execute()
            
            if len(milestone_results.data) != len(milestone_ids):
                found_ids = {m["id"] for m in milestone_results.data}
                missing_ids = [str(m) for m in milestone_ids if str(m) not in found_ids]
                raise ValueError(f"Milestones not found: {missing_ids}")
            
            # Prepare milestone data with metadata
            milestone_data = []
            for milestone in milestone_results.data:
                milestone_data.append({
                    "id": milestone["id"],
                    "name": milestone["name"],
                    "target_date": milestone.get("target_date"),
                    "linked_at": datetime.utcnow().isoformat(),
                    "linked_by": str(linked_by)
                })
            
            # Update change request with milestone links
            update_result = self.db.table("change_requests").update({
                "affected_milestones": milestone_data,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", str(change_id)).execute()
            
            return bool(update_result.data)
            
        except Exception as e:
            logger.error(f"Error linking change {change_id} to milestones: {e}")
            return False
    
    async def link_change_to_purchase_orders(
        self,
        change_id: UUID,
        po_ids: List[UUID],
        linked_by: UUID
    ) -> bool:
        """
        Link a change request to purchase orders.
        
        Args:
            change_id: ID of the change request
            po_ids: List of purchase order IDs
            linked_by: ID of the user creating the links
            
        Returns:
            bool: True if successful
        """
        try:
            # Verify POs exist and get their data
            po_results = self.db.table("purchase_orders").select("id, po_number, total_amount, status").in_("id", [str(p) for p in po_ids]).execute()
            
            if len(po_results.data) != len(po_ids):
                found_ids = {po["id"] for po in po_results.data}
                missing_ids = [str(p) for p in po_ids if str(p) not in found_ids]
                raise ValueError(f"Purchase orders not found: {missing_ids}")
            
            # Prepare PO data with metadata
            po_data = []
            for po in po_results.data:
                po_data.append({
                    "id": po["id"],
                    "po_number": po["po_number"],
                    "total_amount": po.get("total_amount"),
                    "status": po.get("status"),
                    "linked_at": datetime.utcnow().isoformat(),
                    "linked_by": str(linked_by)
                })
            
            # Update change request with PO links
            update_result = self.db.table("change_requests").update({
                "affected_pos": po_data,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", str(change_id)).execute()
            
            return bool(update_result.data)
            
        except Exception as e:
            logger.error(f"Error linking change {change_id} to purchase orders: {e}")
            return False
    
    async def get_project_changes(
        self,
        project_id: UUID,
        include_closed: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get all change requests associated with a project.
        
        Args:
            project_id: ID of the project
            include_closed: Whether to include closed/cancelled changes
            
        Returns:
            List of change request summaries
        """
        try:
            query = self.db.table("change_requests").select(
                "id, change_number, title, status, priority, estimated_cost_impact, requested_date"
            ).eq("project_id", str(project_id))
            
            if not include_closed:
                query = query.not_.in_("status", ["closed", "cancelled"])
            
            result = query.order("requested_date", desc=True).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting changes for project {project_id}: {e}")
            return []
    
    async def get_milestone_changes(
        self,
        milestone_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all change requests affecting a specific milestone.
        
        Args:
            milestone_id: ID of the milestone
            
        Returns:
            List of change request summaries
        """
        try:
            # Query changes where milestone_id appears in affected_milestones
            result = self.db.table("change_requests").select(
                "id, change_number, title, status, priority, estimated_schedule_impact_days"
            ).contains("affected_milestones", [{"id": str(milestone_id)}]).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting changes for milestone {milestone_id}: {e}")
            return []
    
    async def get_po_changes(
        self,
        po_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all change requests affecting a specific purchase order.
        
        Args:
            po_id: ID of the purchase order
            
        Returns:
            List of change request summaries
        """
        try:
            # Query changes where po_id appears in affected_pos
            result = self.db.table("change_requests").select(
                "id, change_number, title, status, priority, estimated_cost_impact"
            ).contains("affected_pos", [{"id": str(po_id)}]).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting changes for PO {po_id}: {e}")
            return []
    
    async def update_project_baselines(
        self,
        change_id: UUID,
        approved_impacts: Dict[str, Any]
    ) -> bool:
        """
        Update project baselines when a change is approved.
        
        Args:
            change_id: ID of the approved change request
            approved_impacts: Approved impact data
            
        Returns:
            bool: True if successful
        """
        try:
            # Get change request details
            change_result = self.db.table("change_requests").select(
                "project_id, estimated_cost_impact, estimated_schedule_impact_days"
            ).eq("id", str(change_id)).execute()
            
            if not change_result.data:
                raise ValueError(f"Change request {change_id} not found")
            
            change_data = change_result.data[0]
            project_id = change_data["project_id"]
            
            # Get current project data
            project_result = self.db.table("projects").select(
                "budget, timeline, baseline_budget, baseline_timeline"
            ).eq("id", project_id).execute()
            
            if not project_result.data:
                raise ValueError(f"Project {project_id} not found")
            
            project_data = project_result.data[0]
            
            # Calculate new baselines
            current_budget = project_data.get("budget", 0)
            current_timeline = project_data.get("timeline")
            
            cost_impact = approved_impacts.get("cost_impact", change_data.get("estimated_cost_impact", 0))
            schedule_impact = approved_impacts.get("schedule_impact_days", change_data.get("estimated_schedule_impact_days", 0))
            
            new_budget = current_budget + float(cost_impact) if cost_impact else current_budget
            
            # Update project baselines
            update_data = {
                "budget": new_budget,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Update timeline if schedule impact exists
            if schedule_impact and current_timeline:
                try:
                    current_end_date = datetime.fromisoformat(current_timeline)
                    new_end_date = current_end_date + timedelta(days=int(schedule_impact))
                    update_data["timeline"] = new_end_date.isoformat()
                except Exception as e:
                    logger.warning(f"Could not update timeline: {e}")
            
            # Store original baselines if not already stored
            if not project_data.get("baseline_budget"):
                update_data["baseline_budget"] = current_budget
            
            if not project_data.get("baseline_timeline") and current_timeline:
                update_data["baseline_timeline"] = current_timeline
            
            # Update project
            update_result = self.db.table("projects").update(update_data).eq("id", project_id).execute()
            
            # Log baseline update
            if update_result.data:
                await self._log_baseline_update(
                    project_id=UUID(project_id),
                    change_id=change_id,
                    old_budget=current_budget,
                    new_budget=new_budget,
                    cost_impact=cost_impact,
                    schedule_impact=schedule_impact
                )
            
            return bool(update_result.data)
            
        except Exception as e:
            logger.error(f"Error updating project baselines for change {change_id}: {e}")
            return False
    
    async def remove_change_links(
        self,
        change_id: UUID,
        link_type: str,
        entity_ids: List[UUID]
    ) -> bool:
        """
        Remove links between change request and project entities.
        
        Args:
            change_id: ID of the change request
            link_type: Type of link ('milestones' or 'pos')
            entity_ids: List of entity IDs to unlink
            
        Returns:
            bool: True if successful
        """
        try:
            # Get current change request
            change_result = self.db.table("change_requests").select(
                "affected_milestones, affected_pos"
            ).eq("id", str(change_id)).execute()
            
            if not change_result.data:
                return False
            
            change_data = change_result.data[0]
            
            if link_type == "milestones":
                current_links = change_data.get("affected_milestones", [])
                field_name = "affected_milestones"
            elif link_type == "pos":
                current_links = change_data.get("affected_pos", [])
                field_name = "affected_pos"
            else:
                raise ValueError(f"Invalid link type: {link_type}")
            
            # Remove specified entities
            entity_ids_str = [str(eid) for eid in entity_ids]
            updated_links = [
                link for link in current_links
                if link.get("id") not in entity_ids_str
            ]
            
            # Update change request
            update_result = self.db.table("change_requests").update({
                field_name: updated_links,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", str(change_id)).execute()
            
            return bool(update_result.data)
            
        except Exception as e:
            logger.error(f"Error removing {link_type} links from change {change_id}: {e}")
            return False
    
    async def get_change_impact_summary(
        self,
        project_id: UUID
    ) -> Dict[str, Any]:
        """
        Get summary of change impacts for a project.
        
        Args:
            project_id: ID of the project
            
        Returns:
            Dict containing impact summary
        """
        try:
            # Get all changes for the project
            changes_result = self.db.table("change_requests").select(
                "status, estimated_cost_impact, actual_cost_impact, estimated_schedule_impact_days, actual_schedule_impact_days"
            ).eq("project_id", str(project_id)).execute()
            
            if not changes_result.data:
                return {
                    "total_changes": 0,
                    "approved_changes": 0,
                    "estimated_cost_impact": 0,
                    "actual_cost_impact": 0,
                    "estimated_schedule_impact": 0,
                    "actual_schedule_impact": 0
                }
            
            changes = changes_result.data
            
            # Calculate summary statistics
            total_changes = len(changes)
            approved_changes = len([c for c in changes if c["status"] in ["approved", "implementing", "implemented", "closed"]])
            
            estimated_cost = sum(float(c.get("estimated_cost_impact", 0)) for c in changes)
            actual_cost = sum(float(c.get("actual_cost_impact", 0)) for c in changes if c.get("actual_cost_impact"))
            
            estimated_schedule = sum(int(c.get("estimated_schedule_impact_days", 0)) for c in changes)
            actual_schedule = sum(int(c.get("actual_schedule_impact_days", 0)) for c in changes if c.get("actual_schedule_impact_days"))
            
            return {
                "total_changes": total_changes,
                "approved_changes": approved_changes,
                "estimated_cost_impact": estimated_cost,
                "actual_cost_impact": actual_cost,
                "estimated_schedule_impact": estimated_schedule,
                "actual_schedule_impact": actual_schedule,
                "cost_variance": actual_cost - estimated_cost if actual_cost > 0 else 0,
                "schedule_variance": actual_schedule - estimated_schedule if actual_schedule > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error getting change impact summary for project {project_id}: {e}")
            return {}
    
    async def _log_baseline_update(
        self,
        project_id: UUID,
        change_id: UUID,
        old_budget: float,
        new_budget: float,
        cost_impact: float,
        schedule_impact: int
    ) -> None:
        """
        Log baseline update for audit purposes.
        
        Args:
            project_id: ID of the project
            change_id: ID of the change request
            old_budget: Previous budget
            new_budget: New budget
            cost_impact: Cost impact amount
            schedule_impact: Schedule impact in days
        """
        try:
            log_data = {
                "change_request_id": str(change_id),
                "event_type": "baseline_updated",
                "event_description": f"Project baselines updated due to approved change",
                "performed_by": "system",  # System-generated update
                "performed_at": datetime.utcnow().isoformat(),
                "old_values": {
                    "budget": old_budget
                },
                "new_values": {
                    "budget": new_budget,
                    "cost_impact": cost_impact,
                    "schedule_impact_days": schedule_impact
                },
                "related_entity_type": "project",
                "related_entity_id": str(project_id)
            }
            
            self.db.table("change_audit_log").insert(log_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging baseline update: {e}")