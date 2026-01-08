"""
Emergency Change Processor Service

Handles expedited workflows for emergency changes with immediate implementation
authorization and comprehensive audit trails.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from decimal import Decimal
from enum import Enum
import logging

from config.database import supabase
from models.change_management import (
    ChangeRequestCreate, ChangeRequestResponse, ChangeStatus, 
    ChangeType, PriorityLevel, ApprovalDecision
)
from .change_request_manager import ChangeRequestManager
from .approval_workflow_engine import ApprovalWorkflowEngine, WorkflowType
from .change_notification_system import ChangeNotificationSystem

logger = logging.getLogger(__name__)

class EmergencyApprovalLevel(str, Enum):
    """Emergency approval authority levels"""
    IMMEDIATE = "immediate"  # Can approve immediately without additional authorization
    EXPEDITED = "expedited"  # Requires single emergency approver
    ESCALATED = "escalated"  # Requires emergency committee approval

class EmergencyImplementationStatus(str, Enum):
    """Emergency implementation status"""
    AUTHORIZED = "authorized"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ROLLED_BACK = "rolled_back"

class EmergencyChangeProcessor:
    """
    Handles expedited workflows for emergency changes.
    
    Provides:
    - Expedited workflow for emergency changes
    - Emergency approver notification and escalation
    - Immediate implementation authorization with audit trail
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        
        self.change_manager = ChangeRequestManager()
        self.workflow_engine = ApprovalWorkflowEngine()
        self.notification_system = ChangeNotificationSystem()
    
    async def process_emergency_change(
        self,
        change_request: ChangeRequestCreate,
        requestor_id: UUID,
        emergency_justification: str,
        immediate_implementation: bool = False
    ) -> Dict[str, Any]:
        """
        Process an emergency change request with expedited workflow.
        
        Args:
            change_request: Emergency change request data
            requestor_id: ID of the user requesting the change
            emergency_justification: Detailed justification for emergency status
            immediate_implementation: Whether immediate implementation is required
            
        Returns:
            Dict containing emergency change processing results
            
        Raises:
            ValueError: If emergency criteria not met
            RuntimeError: If processing fails
        """
        try:
            # Validate emergency criteria
            await self._validate_emergency_criteria(change_request, emergency_justification)
            
            # Create emergency change request
            change_request.priority = PriorityLevel.EMERGENCY
            emergency_change = await self.change_manager.create_change_request(
                change_request, requestor_id
            )
            
            # Determine emergency approval level
            approval_level = await self._determine_emergency_approval_level(
                emergency_change, immediate_implementation
            )
            
            # Process based on approval level
            if approval_level == EmergencyApprovalLevel.IMMEDIATE:
                result = await self._process_immediate_emergency(
                    emergency_change, requestor_id, emergency_justification
                )
            elif approval_level == EmergencyApprovalLevel.EXPEDITED:
                result = await self._process_expedited_emergency(
                    emergency_change, requestor_id, emergency_justification
                )
            else:  # ESCALATED
                result = await self._process_escalated_emergency(
                    emergency_change, requestor_id, emergency_justification
                )
            
            # Log emergency processing
            await self._log_emergency_audit_event(
                change_request_id=UUID(emergency_change.id),
                event_type="emergency_processed",
                event_description=f"Emergency change processed at {approval_level.value} level",
                performed_by=requestor_id,
                emergency_data={
                    "approval_level": approval_level.value,
                    "justification": emergency_justification,
                    "immediate_implementation": immediate_implementation
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing emergency change: {e}")
            raise RuntimeError(f"Failed to process emergency change: {str(e)}")
    
    async def authorize_immediate_implementation(
        self,
        change_id: UUID,
        authorizer_id: UUID,
        implementation_plan: Dict[str, Any],
        rollback_plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Authorize immediate implementation of an emergency change.
        
        Args:
            change_id: ID of the emergency change
            authorizer_id: ID of the user authorizing implementation
            implementation_plan: Detailed implementation plan
            rollback_plan: Rollback plan in case of issues
            
        Returns:
            Dict containing implementation authorization details
            
        Raises:
            ValueError: If change not eligible for immediate implementation
            RuntimeError: If authorization fails
        """
        try:
            # Validate change is emergency and approved
            change = await self.change_manager.get_change_request(change_id)
            if not change:
                raise ValueError(f"Change request {change_id} not found")
            
            if change.priority != PriorityLevel.EMERGENCY.value:
                raise ValueError("Only emergency changes can have immediate implementation")
            
            if change.status not in [ChangeStatus.APPROVED.value, ChangeStatus.PENDING_APPROVAL.value]:
                raise ValueError(f"Change must be approved for immediate implementation, current status: {change.status}")
            
            # Validate authorizer has emergency implementation authority
            if not await self._validate_emergency_implementation_authority(authorizer_id, change):
                raise ValueError("User does not have emergency implementation authority")
            
            # Create implementation authorization record
            authorization_id = uuid4()
            authorization_data = {
                "id": str(authorization_id),
                "change_request_id": str(change_id),
                "authorized_by": str(authorizer_id),
                "authorization_type": "immediate_implementation",
                "implementation_plan": implementation_plan,
                "rollback_plan": rollback_plan,
                "status": EmergencyImplementationStatus.AUTHORIZED.value,
                "authorized_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("emergency_implementations").insert(authorization_data).execute()
            
            # Update change status
            await self.change_manager.update_change_request(
                change_id,
                {"status": ChangeStatus.IMPLEMENTING},
                authorizer_id
            )
            
            # Send immediate notifications
            await self._send_emergency_implementation_notifications(
                change, authorization_id, authorizer_id
            )
            
            # Log authorization
            await self._log_emergency_audit_event(
                change_request_id=change_id,
                event_type="immediate_implementation_authorized",
                event_description="Emergency change authorized for immediate implementation",
                performed_by=authorizer_id,
                emergency_data={
                    "authorization_id": str(authorization_id),
                    "implementation_plan": implementation_plan,
                    "rollback_plan": rollback_plan
                }
            )
            
            return {
                "authorization_id": str(authorization_id),
                "change_id": str(change_id),
                "status": "authorized",
                "authorized_by": str(authorizer_id),
                "authorized_at": datetime.utcnow().isoformat(),
                "implementation_plan": implementation_plan,
                "rollback_plan": rollback_plan
            }
            
        except Exception as e:
            logger.error(f"Error authorizing immediate implementation: {e}")
            raise RuntimeError(f"Failed to authorize immediate implementation: {str(e)}")
    
    async def escalate_emergency_change(
        self,
        change_id: UUID,
        escalator_id: UUID,
        escalation_reason: str,
        urgency_level: str = "critical"
    ) -> Dict[str, Any]:
        """
        Escalate emergency change to higher authority levels.
        
        Args:
            change_id: ID of the emergency change
            escalator_id: ID of the user escalating
            escalation_reason: Reason for escalation
            urgency_level: Level of urgency (critical, severe, high)
            
        Returns:
            Dict containing escalation results
        """
        try:
            # Get change details
            change = await self.change_manager.get_change_request(change_id)
            if not change:
                raise ValueError(f"Change request {change_id} not found")
            
            # Find emergency committee members
            emergency_committee = await self._get_emergency_committee_members()
            
            if not emergency_committee:
                raise RuntimeError("No emergency committee members found")
            
            # Create escalation record
            escalation_id = uuid4()
            escalation_data = {
                "id": str(escalation_id),
                "change_request_id": str(change_id),
                "escalated_by": str(escalator_id),
                "escalation_reason": escalation_reason,
                "urgency_level": urgency_level,
                "committee_members": [str(member["user_id"]) for member in emergency_committee],
                "status": "pending",
                "escalated_at": datetime.utcnow().isoformat(),
                "response_deadline": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("emergency_escalations").insert(escalation_data).execute()
            
            # Send urgent notifications to committee
            await self._send_emergency_escalation_notifications(
                change, escalation_id, emergency_committee, urgency_level
            )
            
            # Log escalation
            await self._log_emergency_audit_event(
                change_request_id=change_id,
                event_type="emergency_escalated",
                event_description=f"Emergency change escalated: {escalation_reason}",
                performed_by=escalator_id,
                emergency_data={
                    "escalation_id": str(escalation_id),
                    "urgency_level": urgency_level,
                    "committee_size": len(emergency_committee)
                }
            )
            
            return {
                "escalation_id": str(escalation_id),
                "change_id": str(change_id),
                "status": "escalated",
                "committee_members": len(emergency_committee),
                "response_deadline": escalation_data["response_deadline"],
                "urgency_level": urgency_level
            }
            
        except Exception as e:
            logger.error(f"Error escalating emergency change: {e}")
            raise RuntimeError(f"Failed to escalate emergency change: {str(e)}")
    
    async def get_emergency_approvers(
        self,
        change_type: ChangeType,
        estimated_impact: Decimal
    ) -> List[Dict[str, Any]]:
        """
        Get list of available emergency approvers for a change type and impact level.
        
        Args:
            change_type: Type of change
            estimated_impact: Estimated cost impact
            
        Returns:
            List of emergency approvers with their authority levels
        """
        try:
            # Query emergency approvers based on change type and authority limits
            query = """
                SELECT 
                    up.user_id,
                    u.email,
                    up.roles,
                    up.approval_limits,
                    up.emergency_contact_info,
                    CASE 
                        WHEN %s <= COALESCE((up.approval_limits->>'emergency')::numeric, 0) THEN 'immediate'
                        WHEN %s <= COALESCE((up.approval_limits->>'expedited')::numeric, 0) THEN 'expedited'
                        ELSE 'escalated'
                    END as approval_level
                FROM user_profiles up
                JOIN auth.users u ON up.user_id = u.id
                WHERE 'emergency_approver' = ANY(up.roles)
                AND up.is_active = true
                AND (up.approval_limits->>'emergency')::numeric >= %s
                ORDER BY (up.approval_limits->>'emergency')::numeric DESC
            """
            
            result = self.db.rpc("execute_sql", {
                "query": query,
                "params": [float(estimated_impact), float(estimated_impact), float(estimated_impact)]
            }).execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Error getting emergency approvers: {e}")
            return []
    
    async def _validate_emergency_criteria(
        self,
        change_request: ChangeRequestCreate,
        justification: str
    ) -> None:
        """
        Validate that change meets emergency criteria.
        
        Args:
            change_request: Change request to validate
            justification: Emergency justification
            
        Raises:
            ValueError: If emergency criteria not met
        """
        # Emergency changes must have justification
        if not justification or len(justification.strip()) < 20:
            raise ValueError("Emergency changes require detailed justification (minimum 20 characters)")
        
        # Emergency changes must have priority set to emergency
        if change_request.priority != PriorityLevel.EMERGENCY:
            raise ValueError("Emergency changes must have EMERGENCY priority level")
        
        # Emergency changes should have required by date within reasonable timeframe
        if change_request.required_by_date:
            max_emergency_timeframe = datetime.now().date() + timedelta(days=7)
            if change_request.required_by_date > max_emergency_timeframe:
                raise ValueError("Emergency changes should be required within 7 days")
        
        # Validate emergency change types
        emergency_types = [
            ChangeType.EMERGENCY, ChangeType.SAFETY, ChangeType.REGULATORY,
            ChangeType.QUALITY
        ]
        
        if change_request.change_type not in emergency_types:
            logger.warning(f"Change type {change_request.change_type} may not qualify for emergency processing")
    
    async def _determine_emergency_approval_level(
        self,
        change: ChangeRequestResponse,
        immediate_implementation: bool
    ) -> EmergencyApprovalLevel:
        """
        Determine the appropriate emergency approval level.
        
        Args:
            change: Emergency change request
            immediate_implementation: Whether immediate implementation is required
            
        Returns:
            EmergencyApprovalLevel: Required approval level
        """
        try:
            cost_impact = change.estimated_cost_impact or Decimal('0')
            
            # Immediate implementation requires higher authority
            if immediate_implementation:
                if cost_impact > 100000:
                    return EmergencyApprovalLevel.ESCALATED
                elif cost_impact > 25000:
                    return EmergencyApprovalLevel.EXPEDITED
                else:
                    return EmergencyApprovalLevel.IMMEDIATE
            
            # Standard emergency approval levels
            if cost_impact > 50000:
                return EmergencyApprovalLevel.ESCALATED
            elif cost_impact > 10000:
                return EmergencyApprovalLevel.EXPEDITED
            else:
                return EmergencyApprovalLevel.IMMEDIATE
                
        except Exception as e:
            logger.error(f"Error determining emergency approval level: {e}")
            return EmergencyApprovalLevel.ESCALATED  # Default to highest level for safety
    
    async def _process_immediate_emergency(
        self,
        change: ChangeRequestResponse,
        requestor_id: UUID,
        justification: str
    ) -> Dict[str, Any]:
        """Process emergency change with immediate approval."""
        try:
            # Auto-approve for immediate emergency
            await self.change_manager.update_change_request(
                UUID(change.id),
                {"status": ChangeStatus.APPROVED},
                requestor_id
            )
            
            # Send immediate notifications
            await self._send_immediate_emergency_notifications(change, requestor_id)
            
            return {
                "change_id": change.id,
                "status": "approved",
                "approval_level": "immediate",
                "approved_at": datetime.utcnow().isoformat(),
                "message": "Emergency change approved immediately"
            }
            
        except Exception as e:
            logger.error(f"Error processing immediate emergency: {e}")
            raise RuntimeError(f"Failed to process immediate emergency: {str(e)}")
    
    async def _process_expedited_emergency(
        self,
        change: ChangeRequestResponse,
        requestor_id: UUID,
        justification: str
    ) -> Dict[str, Any]:
        """Process emergency change with expedited approval workflow."""
        try:
            # Initiate expedited workflow
            workflow = await self.workflow_engine.initiate_approval_workflow(
                UUID(change.id), WorkflowType.EMERGENCY
            )
            
            # Send urgent notifications to emergency approvers
            await self._send_expedited_emergency_notifications(change, workflow)
            
            return {
                "change_id": change.id,
                "status": "pending_emergency_approval",
                "approval_level": "expedited",
                "workflow_id": str(workflow.workflow_id),
                "expected_approval_time": "4 hours",
                "message": "Emergency change submitted for expedited approval"
            }
            
        except Exception as e:
            logger.error(f"Error processing expedited emergency: {e}")
            raise RuntimeError(f"Failed to process expedited emergency: {str(e)}")
    
    async def _process_escalated_emergency(
        self,
        change: ChangeRequestResponse,
        requestor_id: UUID,
        justification: str
    ) -> Dict[str, Any]:
        """Process emergency change requiring committee escalation."""
        try:
            # Escalate to emergency committee
            escalation_result = await self.escalate_emergency_change(
                UUID(change.id), requestor_id, justification, "critical"
            )
            
            return {
                "change_id": change.id,
                "status": "escalated_to_committee",
                "approval_level": "escalated",
                "escalation_id": escalation_result["escalation_id"],
                "response_deadline": escalation_result["response_deadline"],
                "message": "Emergency change escalated to emergency committee"
            }
            
        except Exception as e:
            logger.error(f"Error processing escalated emergency: {e}")
            raise RuntimeError(f"Failed to process escalated emergency: {str(e)}")
    
    async def _validate_emergency_implementation_authority(
        self,
        user_id: UUID,
        change: ChangeRequestResponse
    ) -> bool:
        """
        Validate user has authority to authorize emergency implementation.
        
        Args:
            user_id: User ID to validate
            change: Change request
            
        Returns:
            bool: True if user has authority
        """
        try:
            # Get user profile and roles
            user_result = self.db.table("user_profiles").select(
                "roles, approval_limits"
            ).eq("user_id", str(user_id)).execute()
            
            if not user_result.data:
                return False
            
            user_data = user_result.data[0]
            user_roles = user_data.get("roles", [])
            approval_limits = user_data.get("approval_limits", {})
            
            # Check for emergency implementation role
            if "emergency_implementer" not in user_roles:
                return False
            
            # Check authority limit
            cost_impact = change.estimated_cost_impact or Decimal('0')
            implementation_limit = approval_limits.get("emergency_implementation")
            
            if implementation_limit and cost_impact > Decimal(str(implementation_limit)):
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating emergency implementation authority: {e}")
            return False
    
    async def _get_emergency_committee_members(self) -> List[Dict[str, Any]]:
        """Get emergency committee members."""
        try:
            result = self.db.table("user_profiles").select(
                "user_id, emergency_contact_info"
            ).contains("roles", ["emergency_committee"]).eq("is_active", True).execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Error getting emergency committee members: {e}")
            return []
    
    async def _send_immediate_emergency_notifications(
        self,
        change: ChangeRequestResponse,
        requestor_id: UUID
    ) -> None:
        """Send notifications for immediate emergency approval."""
        try:
            # This would integrate with the notification system
            logger.info(f"Sending immediate emergency notifications for change {change.id}")
            
            # In a real implementation, this would:
            # 1. Send immediate notification to requestor
            # 2. Send alert to emergency response team
            # 3. Send notification to project stakeholders
            # 4. Create audit trail entry
            
        except Exception as e:
            logger.error(f"Error sending immediate emergency notifications: {e}")
    
    async def _send_expedited_emergency_notifications(
        self,
        change: ChangeRequestResponse,
        workflow: Any
    ) -> None:
        """Send notifications for expedited emergency approval."""
        try:
            logger.info(f"Sending expedited emergency notifications for change {change.id}")
            
            # In a real implementation, this would:
            # 1. Send urgent notifications to emergency approvers
            # 2. Set short response deadlines
            # 3. Enable escalation if no response within timeframe
            
        except Exception as e:
            logger.error(f"Error sending expedited emergency notifications: {e}")
    
    async def _send_emergency_implementation_notifications(
        self,
        change: ChangeRequestResponse,
        authorization_id: UUID,
        authorizer_id: UUID
    ) -> None:
        """Send notifications for emergency implementation authorization."""
        try:
            logger.info(f"Sending emergency implementation notifications for change {change.id}")
            
            # In a real implementation, this would:
            # 1. Send immediate notification to implementation team
            # 2. Alert monitoring systems
            # 3. Notify stakeholders of implementation start
            # 4. Set up rollback monitoring
            
        except Exception as e:
            logger.error(f"Error sending emergency implementation notifications: {e}")
    
    async def _send_emergency_escalation_notifications(
        self,
        change: ChangeRequestResponse,
        escalation_id: UUID,
        committee_members: List[Dict[str, Any]],
        urgency_level: str
    ) -> None:
        """Send notifications for emergency escalation."""
        try:
            logger.info(f"Sending emergency escalation notifications for change {change.id}")
            
            # In a real implementation, this would:
            # 1. Send urgent notifications to all committee members
            # 2. Use multiple communication channels (email, SMS, phone)
            # 3. Set very short response deadlines
            # 4. Enable automatic escalation if no response
            
        except Exception as e:
            logger.error(f"Error sending emergency escalation notifications: {e}")
    
    async def _log_emergency_audit_event(
        self,
        change_request_id: UUID,
        event_type: str,
        event_description: str,
        performed_by: UUID,
        emergency_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log emergency-specific audit events.
        
        Args:
            change_request_id: ID of the change request
            event_type: Type of emergency event
            event_description: Description of the event
            performed_by: ID of the user who performed the action
            emergency_data: Emergency-specific data
        """
        try:
            audit_data = {
                "change_request_id": str(change_request_id),
                "event_type": event_type,
                "event_description": event_description,
                "performed_by": str(performed_by),
                "performed_at": datetime.utcnow().isoformat(),
                "new_values": emergency_data,
                "related_entity_type": "emergency_change",
                "compliance_notes": "Emergency change processing - expedited audit trail"
            }
            
            self.db.table("change_audit_log").insert(audit_data).execute()
            
        except Exception as e:
            logger.error(f"Error logging emergency audit event: {e}")
            # Don't raise exception for audit logging failures

class PostImplementationReviewSystem:
    """
    Handles mandatory post-implementation documentation and review for emergency changes.
    
    Provides:
    - Mandatory post-implementation documentation
    - Emergency change pattern analysis and alerting
    - Process improvement recommendations
    """
    
    def __init__(self, emergency_processor: EmergencyChangeProcessor):
        self.emergency_processor = emergency_processor
        self.db = emergency_processor.db
        self.change_manager = emergency_processor.change_manager
        self.notification_system = emergency_processor.notification_system
    
    async def initiate_post_implementation_review(
        self,
        change_id: UUID,
        implementation_completed_by: UUID,
        actual_implementation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Initiate mandatory post-implementation review for emergency change.
        
        Args:
            change_id: ID of the emergency change
            implementation_completed_by: User who completed implementation
            actual_implementation_data: Actual implementation details
            
        Returns:
            Dict containing review initiation details
            
        Raises:
            ValueError: If change not eligible for review
            RuntimeError: If review initiation fails
        """
        try:
            # Validate change is emergency and implemented
            change = await self.change_manager.get_change_request(change_id)
            if not change:
                raise ValueError(f"Change request {change_id} not found")
            
            if change.priority != PriorityLevel.EMERGENCY.value:
                raise ValueError("Post-implementation review only applies to emergency changes")
            
            if change.status != ChangeStatus.IMPLEMENTED.value:
                raise ValueError(f"Change must be implemented for review, current status: {change.status}")
            
            # Create post-implementation review record
            review_id = uuid4()
            review_data = {
                "id": str(review_id),
                "change_request_id": str(change_id),
                "implementation_completed_by": str(implementation_completed_by),
                "actual_implementation_data": actual_implementation_data,
                "review_status": "pending",
                "review_deadline": (datetime.utcnow() + timedelta(hours=48)).isoformat(),
                "mandatory_sections": {
                    "implementation_summary": {"completed": False, "required": True},
                    "deviation_analysis": {"completed": False, "required": True},
                    "impact_assessment": {"completed": False, "required": True},
                    "lessons_learned": {"completed": False, "required": True},
                    "process_improvements": {"completed": False, "required": True},
                    "rollback_assessment": {"completed": False, "required": True}
                },
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("emergency_post_implementation_reviews").insert(review_data).execute()
            
            # Assign reviewers
            reviewers = await self._assign_post_implementation_reviewers(change, review_id)
            
            # Send review notifications
            await self._send_post_implementation_review_notifications(
                change, review_id, reviewers, implementation_completed_by
            )
            
            # Log review initiation
            await self.emergency_processor._log_emergency_audit_event(
                change_request_id=change_id,
                event_type="post_implementation_review_initiated",
                event_description="Mandatory post-implementation review initiated",
                performed_by=implementation_completed_by,
                emergency_data={
                    "review_id": str(review_id),
                    "reviewers": [str(r["user_id"]) for r in reviewers],
                    "deadline": review_data["review_deadline"]
                }
            )
            
            return {
                "review_id": str(review_id),
                "change_id": str(change_id),
                "status": "initiated",
                "deadline": review_data["review_deadline"],
                "reviewers": reviewers,
                "mandatory_sections": list(review_data["mandatory_sections"].keys())
            }
            
        except Exception as e:
            logger.error(f"Error initiating post-implementation review: {e}")
            raise RuntimeError(f"Failed to initiate post-implementation review: {str(e)}")
    
    async def submit_review_section(
        self,
        review_id: UUID,
        section_name: str,
        section_data: Dict[str, Any],
        submitted_by: UUID
    ) -> Dict[str, Any]:
        """
        Submit a section of the post-implementation review.
        
        Args:
            review_id: ID of the review
            section_name: Name of the section being submitted
            section_data: Section content and data
            submitted_by: User submitting the section
            
        Returns:
            Dict containing submission results
        """
        try:
            # Get review record
            review_result = self.db.table("emergency_post_implementation_reviews").select("*").eq(
                "id", str(review_id)
            ).execute()
            
            if not review_result.data:
                raise ValueError(f"Review {review_id} not found")
            
            review_data = review_result.data[0]
            mandatory_sections = review_data["mandatory_sections"]
            
            # Validate section exists and is required
            if section_name not in mandatory_sections:
                raise ValueError(f"Invalid section name: {section_name}")
            
            # Update section completion
            mandatory_sections[section_name]["completed"] = True
            mandatory_sections[section_name]["submitted_by"] = str(submitted_by)
            mandatory_sections[section_name]["submitted_at"] = datetime.utcnow().isoformat()
            mandatory_sections[section_name]["data"] = section_data
            
            # Check if all mandatory sections are complete
            all_complete = all(
                section["completed"] for section in mandatory_sections.values() 
                if section["required"]
            )
            
            # Update review record
            update_data = {
                "mandatory_sections": mandatory_sections,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if all_complete:
                update_data["review_status"] = "completed"
                update_data["completed_at"] = datetime.utcnow().isoformat()
            
            self.db.table("emergency_post_implementation_reviews").update(update_data).eq(
                "id", str(review_id)
            ).execute()
            
            # If review is complete, trigger analysis
            if all_complete:
                await self._complete_post_implementation_review(review_id, review_data)
            
            return {
                "review_id": str(review_id),
                "section_name": section_name,
                "status": "submitted",
                "review_complete": all_complete,
                "submitted_by": str(submitted_by),
                "submitted_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error submitting review section: {e}")
            raise RuntimeError(f"Failed to submit review section: {str(e)}")
    
    async def analyze_emergency_change_patterns(
        self,
        analysis_period_days: int = 90
    ) -> Dict[str, Any]:
        """
        Analyze emergency change patterns and generate alerts for concerning trends.
        
        Args:
            analysis_period_days: Number of days to analyze
            
        Returns:
            Dict containing pattern analysis results and alerts
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=analysis_period_days)
            
            # Query emergency changes in the period
            emergency_changes_query = """
                SELECT 
                    cr.*,
                    epir.review_status,
                    epir.mandatory_sections,
                    ei.status as implementation_status,
                    ei.rollback_plan
                FROM change_requests cr
                LEFT JOIN emergency_post_implementation_reviews epir ON cr.id = epir.change_request_id
                LEFT JOIN emergency_implementations ei ON cr.id = ei.change_request_id
                WHERE cr.priority = 'emergency'
                AND cr.created_at >= %s
                ORDER BY cr.created_at DESC
            """
            
            result = self.db.rpc("execute_sql", {
                "query": emergency_changes_query,
                "params": [cutoff_date.isoformat()]
            }).execute()
            
            emergency_changes = result.data
            
            # Analyze patterns
            analysis = await self._analyze_change_patterns(emergency_changes)
            
            # Generate alerts for concerning patterns
            alerts = await self._generate_pattern_alerts(analysis)
            
            # Store analysis results
            analysis_id = uuid4()
            analysis_record = {
                "id": str(analysis_id),
                "analysis_period_days": analysis_period_days,
                "total_emergency_changes": len(emergency_changes),
                "pattern_analysis": analysis,
                "alerts_generated": alerts,
                "analyzed_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("emergency_pattern_analyses").insert(analysis_record).execute()
            
            # Send alerts if any concerning patterns found
            if alerts:
                await self._send_pattern_alert_notifications(analysis_id, alerts)
            
            return {
                "analysis_id": str(analysis_id),
                "period_analyzed": analysis_period_days,
                "total_changes": len(emergency_changes),
                "patterns": analysis,
                "alerts": alerts,
                "analyzed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing emergency change patterns: {e}")
            raise RuntimeError(f"Failed to analyze emergency change patterns: {str(e)}")
    
    async def generate_process_improvement_recommendations(
        self,
        analysis_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate process improvement recommendations based on emergency change analysis.
        
        Args:
            analysis_id: Optional specific analysis to base recommendations on
            
        Returns:
            List of process improvement recommendations
        """
        try:
            # Get latest analysis if none specified
            if not analysis_id:
                latest_analysis = self.db.table("emergency_pattern_analyses").select("*").order(
                    "analyzed_at", desc=True
                ).limit(1).execute()
                
                if not latest_analysis.data:
                    raise ValueError("No pattern analysis found")
                
                analysis_data = latest_analysis.data[0]
            else:
                analysis_result = self.db.table("emergency_pattern_analyses").select("*").eq(
                    "id", str(analysis_id)
                ).execute()
                
                if not analysis_result.data:
                    raise ValueError(f"Analysis {analysis_id} not found")
                
                analysis_data = analysis_result.data[0]
            
            # Generate recommendations based on patterns
            recommendations = []
            patterns = analysis_data["pattern_analysis"]
            
            # High frequency recommendations
            if patterns.get("frequency_trend", {}).get("increasing", False):
                recommendations.append({
                    "category": "frequency_management",
                    "priority": "high",
                    "title": "Reduce Emergency Change Frequency",
                    "description": "Emergency changes are increasing. Consider improving planning processes.",
                    "specific_actions": [
                        "Implement more thorough change impact analysis",
                        "Improve project planning and risk assessment",
                        "Establish better communication channels for early issue identification"
                    ],
                    "expected_impact": "Reduce emergency changes by 30-50%",
                    "implementation_effort": "medium"
                })
            
            # Common failure patterns
            if patterns.get("common_failure_types"):
                for failure_type, count in patterns["common_failure_types"].items():
                    if count > 2:  # More than 2 occurrences
                        recommendations.append({
                            "category": "failure_prevention",
                            "priority": "medium",
                            "title": f"Address {failure_type.title()} Issues",
                            "description": f"Multiple emergency changes due to {failure_type} issues detected.",
                            "specific_actions": [
                                f"Implement additional {failure_type} testing procedures",
                                f"Create {failure_type} checklist for standard changes",
                                f"Provide additional training on {failure_type} best practices"
                            ],
                            "expected_impact": f"Reduce {failure_type}-related emergencies by 60%",
                            "implementation_effort": "low"
                        })
            
            # Review completion issues
            if patterns.get("review_completion_rate", 100) < 90:
                recommendations.append({
                    "category": "review_process",
                    "priority": "high",
                    "title": "Improve Post-Implementation Review Compliance",
                    "description": "Post-implementation reviews are not being completed consistently.",
                    "specific_actions": [
                        "Implement automated review reminders",
                        "Assign dedicated review coordinators",
                        "Simplify review process and templates",
                        "Provide training on review importance"
                    ],
                    "expected_impact": "Achieve 95%+ review completion rate",
                    "implementation_effort": "medium"
                })
            
            # Implementation time recommendations
            if patterns.get("avg_implementation_time_hours", 0) > 8:
                recommendations.append({
                    "category": "implementation_efficiency",
                    "priority": "medium",
                    "title": "Improve Emergency Implementation Speed",
                    "description": "Emergency implementations are taking longer than optimal.",
                    "specific_actions": [
                        "Pre-approve common emergency procedures",
                        "Create emergency implementation playbooks",
                        "Establish dedicated emergency response teams",
                        "Improve rollback procedures"
                    ],
                    "expected_impact": "Reduce average implementation time by 40%",
                    "implementation_effort": "high"
                })
            
            # Store recommendations
            recommendation_record = {
                "analysis_id": analysis_data["id"],
                "recommendations": recommendations,
                "generated_at": datetime.utcnow().isoformat(),
                "status": "pending_review",
                "created_at": datetime.utcnow().isoformat()
            }
            
            self.db.table("process_improvement_recommendations").insert(recommendation_record).execute()
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating process improvement recommendations: {e}")
            raise RuntimeError(f"Failed to generate process improvement recommendations: {str(e)}")
    
    async def _assign_post_implementation_reviewers(
        self,
        change: ChangeRequestResponse,
        review_id: UUID
    ) -> List[Dict[str, Any]]:
        """Assign reviewers for post-implementation review."""
        try:
            reviewers = []
            
            # Always include project manager
            if change.project_id:
                project_result = self.db.table("projects").select("manager_id").eq("id", change.project_id).execute()
                if project_result.data and project_result.data[0]["manager_id"]:
                    reviewers.append({
                        "user_id": project_result.data[0]["manager_id"],
                        "role": "project_manager",
                        "required": True
                    })
            
            # Include emergency change coordinator
            coordinator_result = self.db.table("user_profiles").select("user_id").contains(
                "roles", ["emergency_coordinator"]
            ).eq("is_active", True).limit(1).execute()
            
            if coordinator_result.data:
                reviewers.append({
                    "user_id": coordinator_result.data[0]["user_id"],
                    "role": "emergency_coordinator",
                    "required": True
                })
            
            # Include technical lead for technical changes
            if change.change_type in ["design", "quality", "safety"]:
                tech_lead_result = self.db.table("user_profiles").select("user_id").contains(
                    "roles", ["technical_lead"]
                ).eq("is_active", True).limit(1).execute()
                
                if tech_lead_result.data:
                    reviewers.append({
                        "user_id": tech_lead_result.data[0]["user_id"],
                        "role": "technical_lead",
                        "required": False
                    })
            
            # Create reviewer assignments
            for reviewer in reviewers:
                assignment_data = {
                    "review_id": str(review_id),
                    "reviewer_id": reviewer["user_id"],
                    "reviewer_role": reviewer["role"],
                    "is_required": reviewer["required"],
                    "assigned_at": datetime.utcnow().isoformat(),
                    "status": "assigned"
                }
                
                self.db.table("review_assignments").insert(assignment_data).execute()
            
            return reviewers
            
        except Exception as e:
            logger.error(f"Error assigning reviewers: {e}")
            return []
    
    async def _complete_post_implementation_review(
        self,
        review_id: UUID,
        review_data: Dict[str, Any]
    ) -> None:
        """Complete post-implementation review and trigger follow-up actions."""
        try:
            change_id = UUID(review_data["change_request_id"])
            
            # Update change status to closed
            await self.change_manager.update_change_request(
                change_id,
                {"status": ChangeStatus.CLOSED},
                UUID(review_data["implementation_completed_by"])
            )
            
            # Extract lessons learned for knowledge base
            lessons_learned = review_data["mandatory_sections"].get("lessons_learned", {}).get("data", {})
            if lessons_learned:
                await self._store_lessons_learned(change_id, lessons_learned)
            
            # Trigger pattern analysis if needed
            await self._check_pattern_analysis_trigger()
            
            # Log completion
            await self.emergency_processor._log_emergency_audit_event(
                change_request_id=change_id,
                event_type="post_implementation_review_completed",
                event_description="Post-implementation review completed successfully",
                performed_by=UUID(review_data["implementation_completed_by"]),
                emergency_data={"review_id": str(review_id)}
            )
            
        except Exception as e:
            logger.error(f"Error completing post-implementation review: {e}")
    
    async def _analyze_change_patterns(
        self,
        emergency_changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze patterns in emergency changes."""
        try:
            if not emergency_changes:
                return {
                    "total_changes": 0,
                    "monthly_distribution": {},
                    "type_distribution": {},
                    "review_completion_rate": 0,
                    "avg_implementation_time_hours": 0,
                    "frequency_trend": {"trend": "insufficient_data"}
                }
            
            # Frequency analysis
            monthly_counts = {}
            for change in emergency_changes:
                created_at = change.get("created_at", "")
                # Validate date format before processing
                if isinstance(created_at, str) and len(created_at) >= 7:
                    try:
                        # Try to parse as ISO format first
                        if "T" in created_at or "+" in created_at:
                            parsed_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                            month_key = parsed_date.strftime("%Y-%m")
                        else:
                            # Assume it's already in YYYY-MM format or similar
                            month_key = created_at[:7]
                            # Validate the format
                            if len(month_key) == 7 and month_key[4] == '-':
                                year, month = month_key.split('-')
                                if year.isdigit() and month.isdigit() and 1 <= int(month) <= 12:
                                    pass  # Valid format
                                else:
                                    continue  # Skip invalid dates
                            else:
                                continue  # Skip invalid formats
                        
                        monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
                    except (ValueError, IndexError):
                        # Skip invalid date formats
                        continue
            
            # Type analysis
            type_counts = {}
            for change in emergency_changes:
                change_type = change.get("change_type", "unknown")
                if isinstance(change_type, str):
                    type_counts[change_type] = type_counts.get(change_type, 0) + 1
            
            # Review completion analysis
            completed_reviews = sum(1 for change in emergency_changes 
                                  if change.get("review_status") == "completed")
            review_completion_rate = (completed_reviews / len(emergency_changes)) * 100 if emergency_changes else 0
            
            # Implementation time analysis
            implementation_times = []
            for change in emergency_changes:
                start_date = change.get("implementation_start_date")
                end_date = change.get("implementation_end_date")
                
                if start_date and end_date and isinstance(start_date, str) and isinstance(end_date, str):
                    try:
                        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                        hours = (end - start).total_seconds() / 3600
                        if hours >= 0:  # Only include valid time differences
                            implementation_times.append(hours)
                    except (ValueError, AttributeError):
                        # Skip invalid date formats
                        continue
            
            avg_implementation_time = sum(implementation_times) / len(implementation_times) if implementation_times else 0
            
            return {
                "total_changes": len(emergency_changes),
                "monthly_distribution": monthly_counts,
                "type_distribution": type_counts,
                "review_completion_rate": review_completion_rate,
                "avg_implementation_time_hours": avg_implementation_time,
                "frequency_trend": self._calculate_frequency_trend(monthly_counts)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing change patterns: {e}")
            return {
                "total_changes": 0,
                "monthly_distribution": {},
                "type_distribution": {},
                "review_completion_rate": 0,
                "avg_implementation_time_hours": 0,
                "frequency_trend": {"trend": "insufficient_data"}
            }
    
    def _calculate_frequency_trend(self, monthly_counts: Dict[str, int]) -> Dict[str, Any]:
        """Calculate if emergency change frequency is increasing or decreasing."""
        if len(monthly_counts) < 2:
            return {"trend": "insufficient_data"}
        
        months = sorted(monthly_counts.keys())
        recent_months = months[-3:] if len(months) >= 3 else months
        earlier_months = months[:-3] if len(months) >= 6 else months[:-len(recent_months)]
        
        if not earlier_months:
            return {"trend": "insufficient_data"}
        
        recent_avg = sum(monthly_counts[month] for month in recent_months) / len(recent_months)
        earlier_avg = sum(monthly_counts[month] for month in earlier_months) / len(earlier_months)
        
        if recent_avg > earlier_avg * 1.2:  # 20% increase threshold
            return {"trend": "increasing", "recent_avg": recent_avg, "earlier_avg": earlier_avg}
        elif recent_avg < earlier_avg * 0.8:  # 20% decrease threshold
            return {"trend": "decreasing", "recent_avg": recent_avg, "earlier_avg": earlier_avg}
        else:
            return {"trend": "stable", "recent_avg": recent_avg, "earlier_avg": earlier_avg}
    
    async def _generate_pattern_alerts(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate alerts based on pattern analysis."""
        alerts = []
        
        # High frequency alert
        frequency_trend = analysis.get("frequency_trend", {})
        if isinstance(frequency_trend, dict) and frequency_trend.get("trend") == "increasing":
            recent_avg = frequency_trend.get("recent_avg", 0)
            earlier_avg = frequency_trend.get("earlier_avg", 1)  # Avoid division by zero
            
            if earlier_avg > 0:
                increase_percent = ((recent_avg / earlier_avg) - 1) * 100
                alerts.append({
                    "type": "high_frequency",
                    "severity": "high",
                    "title": "Increasing Emergency Change Frequency",
                    "description": f"Emergency changes have increased by {increase_percent:.1f}% in recent months",
                    "recommendation": "Review project planning and risk management processes"
                })
        
        # Low review completion alert
        review_completion_rate = analysis.get("review_completion_rate", 100)
        if isinstance(review_completion_rate, (int, float)) and review_completion_rate < 80:
            alerts.append({
                "type": "low_review_completion",
                "severity": "medium",
                "title": "Low Post-Implementation Review Completion",
                "description": f"Only {review_completion_rate:.1f}% of emergency changes have completed reviews",
                "recommendation": "Implement mandatory review enforcement and training"
            })
        
        # Long implementation time alert
        avg_impl_time = analysis.get("avg_implementation_time_hours", 0)
        if isinstance(avg_impl_time, (int, float)) and avg_impl_time > 12:
            alerts.append({
                "type": "long_implementation_time",
                "severity": "medium",
                "title": "Extended Emergency Implementation Times",
                "description": f"Average emergency implementation time is {avg_impl_time:.1f} hours",
                "recommendation": "Review emergency procedures and response capabilities"
            })
        
        return alerts
    
    async def _send_post_implementation_review_notifications(
        self,
        change: ChangeRequestResponse,
        review_id: UUID,
        reviewers: List[Dict[str, Any]],
        implementation_completed_by: UUID
    ) -> None:
        """Send notifications for post-implementation review."""
        try:
            logger.info(f"Sending post-implementation review notifications for change {change.id}")
            
            # In a real implementation, this would:
            # 1. Send notifications to all assigned reviewers
            # 2. Set review deadlines and reminders
            # 3. Provide review templates and guidance
            # 4. Enable review tracking and progress monitoring
            
        except Exception as e:
            logger.error(f"Error sending post-implementation review notifications: {e}")
    
    async def _send_pattern_alert_notifications(
        self,
        analysis_id: UUID,
        alerts: List[Dict[str, Any]]
    ) -> None:
        """Send notifications for pattern analysis alerts."""
        try:
            logger.info(f"Sending pattern alert notifications for analysis {analysis_id}")
            
            # In a real implementation, this would:
            # 1. Send alerts to emergency coordinators
            # 2. Notify management of concerning trends
            # 3. Trigger process improvement initiatives
            # 4. Create action items for follow-up
            
        except Exception as e:
            logger.error(f"Error sending pattern alert notifications: {e}")
    
    async def _store_lessons_learned(
        self,
        change_id: UUID,
        lessons_learned: Dict[str, Any]
    ) -> None:
        """Store lessons learned in knowledge base."""
        try:
            knowledge_entry = {
                "change_request_id": str(change_id),
                "category": "emergency_change",
                "lessons_learned": lessons_learned,
                "created_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            
            self.db.table("knowledge_base").insert(knowledge_entry).execute()
            
        except Exception as e:
            logger.error(f"Error storing lessons learned: {e}")
    
    async def _check_pattern_analysis_trigger(self) -> None:
        """Check if pattern analysis should be triggered."""
        try:
            # Check if it's been more than 30 days since last analysis
            last_analysis = self.db.table("emergency_pattern_analyses").select("analyzed_at").order(
                "analyzed_at", desc=True
            ).limit(1).execute()
            
            if not last_analysis.data:
                # No previous analysis, trigger one
                await self.analyze_emergency_change_patterns()
                return
            
            last_analysis_date = datetime.fromisoformat(last_analysis.data[0]["analyzed_at"].replace("Z", "+00:00"))
            if (datetime.utcnow() - last_analysis_date).days >= 30:
                await self.analyze_emergency_change_patterns()
            
        except Exception as e:
            logger.error(f"Error checking pattern analysis trigger: {e}")