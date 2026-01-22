"""
Workflow Analytics Service

Provides comprehensive analytics and metrics collection for workflow execution,
including duration tracking, approval times, rejection rates, and bottleneck detection.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from config.database import supabase

logger = logging.getLogger(__name__)


class WorkflowAnalyticsService:
    """
    Service for collecting and analyzing workflow execution metrics.
    
    Tracks workflow performance metrics including:
    - Workflow execution duration
    - Approval response times
    - Rejection rates
    - Bottleneck identification
    - Approver efficiency metrics
    """
    
    def __init__(self):
        """Initialize the workflow analytics service."""
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    async def collect_workflow_metrics(
        self,
        instance_id: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """
        Collect comprehensive metrics for a workflow instance.
        
        Args:
            instance_id: ID of the workflow instance
            organization_id: Organization ID for filtering
            
        Returns:
            Dict containing workflow metrics including duration, approval times,
            and step-by-step performance data
            
        Raises:
            ValueError: If instance not found
            RuntimeError: If metrics collection fails
        """
        try:
            # Get workflow instance
            instance_result = self.db.table("workflow_instances").select("*").eq(
                "id", instance_id
            ).execute()
            
            if not instance_result.data:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            instance = instance_result.data[0]
            
            # Verify organization
            instance_org_id = instance.get("data", {}).get("organization_id")
            if instance_org_id != organization_id:
                raise ValueError("Workflow instance not found in organization")
            
            # Calculate overall workflow duration
            started_at = datetime.fromisoformat(instance["started_at"].replace("Z", "+00:00"))
            
            if instance.get("completed_at"):
                completed_at = datetime.fromisoformat(instance["completed_at"].replace("Z", "+00:00"))
                total_duration_hours = (completed_at - started_at).total_seconds() / 3600
            else:
                # Workflow still in progress
                total_duration_hours = (datetime.utcnow() - started_at).total_seconds() / 3600
            
            # Get all approvals for this instance
            approvals_result = self.db.table("workflow_approvals").select("*").eq(
                "workflow_instance_id", instance_id
            ).order("step_number").execute()
            
            # Calculate approval metrics by step
            step_metrics = {}
            total_approval_time = 0
            approved_count = 0
            rejected_count = 0
            pending_count = 0
            
            for approval in approvals_result.data:
                step_num = approval["step_number"]
                
                if step_num not in step_metrics:
                    step_metrics[step_num] = {
                        "step_number": step_num,
                        "approvals": [],
                        "avg_response_time_hours": 0,
                        "min_response_time_hours": None,
                        "max_response_time_hours": None,
                        "approved_count": 0,
                        "rejected_count": 0,
                        "pending_count": 0
                    }
                
                # Calculate approval response time
                created_at = datetime.fromisoformat(approval["created_at"].replace("Z", "+00:00"))
                
                if approval["approved_at"]:
                    approved_at = datetime.fromisoformat(approval["approved_at"].replace("Z", "+00:00"))
                    response_time_hours = (approved_at - created_at).total_seconds() / 3600
                    
                    step_metrics[step_num]["approvals"].append({
                        "approver_id": approval["approver_id"],
                        "status": approval["status"],
                        "response_time_hours": response_time_hours,
                        "approved_at": approval["approved_at"]
                    })
                    
                    total_approval_time += response_time_hours
                    
                    # Update min/max response times
                    if step_metrics[step_num]["min_response_time_hours"] is None:
                        step_metrics[step_num]["min_response_time_hours"] = response_time_hours
                    else:
                        step_metrics[step_num]["min_response_time_hours"] = min(
                            step_metrics[step_num]["min_response_time_hours"],
                            response_time_hours
                        )
                    
                    if step_metrics[step_num]["max_response_time_hours"] is None:
                        step_metrics[step_num]["max_response_time_hours"] = response_time_hours
                    else:
                        step_metrics[step_num]["max_response_time_hours"] = max(
                            step_metrics[step_num]["max_response_time_hours"],
                            response_time_hours
                        )
                else:
                    # Pending approval
                    step_metrics[step_num]["approvals"].append({
                        "approver_id": approval["approver_id"],
                        "status": approval["status"],
                        "response_time_hours": None,
                        "approved_at": None
                    })
                
                # Count approval statuses
                if approval["status"] == "approved":
                    step_metrics[step_num]["approved_count"] += 1
                    approved_count += 1
                elif approval["status"] == "rejected":
                    step_metrics[step_num]["rejected_count"] += 1
                    rejected_count += 1
                else:
                    step_metrics[step_num]["pending_count"] += 1
                    pending_count += 1
            
            # Calculate average response times per step
            for step_num, metrics in step_metrics.items():
                completed_approvals = [a for a in metrics["approvals"] if a["response_time_hours"] is not None]
                if completed_approvals:
                    metrics["avg_response_time_hours"] = sum(
                        a["response_time_hours"] for a in completed_approvals
                    ) / len(completed_approvals)
            
            # Calculate overall metrics
            total_approvals = len(approvals_result.data)
            completed_approvals = approved_count + rejected_count
            avg_approval_time_hours = total_approval_time / completed_approvals if completed_approvals > 0 else 0
            
            rejection_rate = rejected_count / total_approvals if total_approvals > 0 else 0
            approval_rate = approved_count / total_approvals if total_approvals > 0 else 0
            
            # Identify bottlenecks (steps with longest average response times)
            bottlenecks = []
            if step_metrics:
                sorted_steps = sorted(
                    step_metrics.values(),
                    key=lambda x: x["avg_response_time_hours"],
                    reverse=True
                )
                
                # Consider top 2 slowest steps as bottlenecks if they exceed average by 50%
                if avg_approval_time_hours > 0:
                    for step in sorted_steps[:2]:
                        if step["avg_response_time_hours"] > avg_approval_time_hours * 1.5:
                            bottlenecks.append({
                                "step_number": step["step_number"],
                                "avg_response_time_hours": step["avg_response_time_hours"],
                                "delay_factor": step["avg_response_time_hours"] / avg_approval_time_hours
                            })
            
            return {
                "instance_id": instance_id,
                "workflow_id": instance["workflow_id"],
                "status": instance["status"],
                "total_duration_hours": round(total_duration_hours, 2),
                "started_at": instance["started_at"],
                "completed_at": instance.get("completed_at"),
                "approval_metrics": {
                    "total_approvals": total_approvals,
                    "approved_count": approved_count,
                    "rejected_count": rejected_count,
                    "pending_count": pending_count,
                    "approval_rate": round(approval_rate, 4),
                    "rejection_rate": round(rejection_rate, 4),
                    "avg_approval_time_hours": round(avg_approval_time_hours, 2)
                },
                "step_metrics": list(step_metrics.values()),
                "bottlenecks": bottlenecks,
                "collected_at": datetime.utcnow().isoformat()
            }
            
        except ValueError as e:
            logger.error(f"Validation error collecting workflow metrics: {e}")
            raise
        except Exception as e:
            logger.error(f"Error collecting workflow metrics for instance {instance_id}: {e}")
            raise RuntimeError(f"Failed to collect workflow metrics: {str(e)}")
    
    async def calculate_approver_response_times(
        self,
        organization_id: str,
        approver_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculate approver response time analytics.
        
        Args:
            organization_id: Organization ID for filtering
            approver_id: Optional specific approver ID to analyze
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            Dict containing approver efficiency metrics including average response
            times, approval rates, and performance trends
            
        Raises:
            RuntimeError: If calculation fails
        """
        try:
            # Build query for approvals
            query = self.db.table("workflow_approvals").select(
                "*, workflow_instances!inner(data)"
            )
            
            if approver_id:
                query = query.eq("approver_id", approver_id)
            
            if start_date:
                query = query.gte("created_at", start_date.isoformat())
            
            if end_date:
                query = query.lte("created_at", end_date.isoformat())
            
            approvals_result = query.execute()
            
            # Filter by organization
            approvals = [
                a for a in approvals_result.data
                if a.get("workflow_instances", {}).get("data", {}).get("organization_id") == organization_id
            ]
            
            if not approvals:
                return {
                    "organization_id": organization_id,
                    "approver_id": approver_id,
                    "total_approvals": 0,
                    "metrics": {}
                }
            
            # Group approvals by approver
            approver_metrics = {}
            
            for approval in approvals:
                aid = approval["approver_id"]
                
                if aid not in approver_metrics:
                    approver_metrics[aid] = {
                        "approver_id": aid,
                        "total_approvals": 0,
                        "approved_count": 0,
                        "rejected_count": 0,
                        "pending_count": 0,
                        "response_times": [],
                        "avg_response_time_hours": 0,
                        "min_response_time_hours": None,
                        "max_response_time_hours": None
                    }
                
                approver_metrics[aid]["total_approvals"] += 1
                
                # Count status
                if approval["status"] == "approved":
                    approver_metrics[aid]["approved_count"] += 1
                elif approval["status"] == "rejected":
                    approver_metrics[aid]["rejected_count"] += 1
                else:
                    approver_metrics[aid]["pending_count"] += 1
                
                # Calculate response time
                if approval["approved_at"]:
                    created_at = datetime.fromisoformat(approval["created_at"].replace("Z", "+00:00"))
                    approved_at = datetime.fromisoformat(approval["approved_at"].replace("Z", "+00:00"))
                    response_time_hours = (approved_at - created_at).total_seconds() / 3600
                    
                    approver_metrics[aid]["response_times"].append(response_time_hours)
            
            # Calculate statistics for each approver
            for aid, metrics in approver_metrics.items():
                if metrics["response_times"]:
                    metrics["avg_response_time_hours"] = round(
                        sum(metrics["response_times"]) / len(metrics["response_times"]), 2
                    )
                    metrics["min_response_time_hours"] = round(min(metrics["response_times"]), 2)
                    metrics["max_response_time_hours"] = round(max(metrics["response_times"]), 2)
                
                # Remove raw response times from output
                del metrics["response_times"]
                
                # Calculate approval rate
                completed = metrics["approved_count"] + metrics["rejected_count"]
                metrics["approval_rate"] = round(
                    metrics["approved_count"] / completed if completed > 0 else 0, 4
                )
            
            return {
                "organization_id": organization_id,
                "approver_id": approver_id,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "total_approvals": len(approvals),
                "approver_count": len(approver_metrics),
                "metrics": list(approver_metrics.values()),
                "calculated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating approver response times: {e}")
            raise RuntimeError(f"Failed to calculate approver response times: {str(e)}")
    
    async def identify_workflow_bottlenecks(
        self,
        organization_id: str,
        workflow_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Identify bottlenecks and delays in workflow processes.
        
        Args:
            organization_id: Organization ID for filtering
            workflow_id: Optional specific workflow ID to analyze
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            Dict containing bottleneck analysis including slow steps, delayed
            approvals, and recommendations for process improvement
            
        Raises:
            RuntimeError: If analysis fails
        """
        try:
            # Build query for workflow instances
            query = self.db.table("workflow_instances").select("*")
            
            if workflow_id:
                query = query.eq("workflow_id", workflow_id)
            
            if start_date:
                query = query.gte("started_at", start_date.isoformat())
            
            if end_date:
                query = query.lte("started_at", end_date.isoformat())
            
            instances_result = query.execute()
            
            # Filter by organization
            instances = [
                i for i in instances_result.data
                if i.get("data", {}).get("organization_id") == organization_id
            ]
            
            if not instances:
                return {
                    "organization_id": organization_id,
                    "workflow_id": workflow_id,
                    "total_instances": 0,
                    "bottlenecks": []
                }
            
            # Collect metrics for each instance
            all_step_metrics = {}
            workflow_durations = []
            
            for instance in instances:
                try:
                    metrics = await self.collect_workflow_metrics(
                        instance["id"], organization_id
                    )
                    
                    workflow_durations.append(metrics["total_duration_hours"])
                    
                    # Aggregate step metrics
                    for step_metric in metrics["step_metrics"]:
                        step_num = step_metric["step_number"]
                        
                        if step_num not in all_step_metrics:
                            all_step_metrics[step_num] = {
                                "step_number": step_num,
                                "response_times": [],
                                "approval_counts": 0,
                                "rejection_counts": 0
                            }
                        
                        if step_metric["avg_response_time_hours"] > 0:
                            all_step_metrics[step_num]["response_times"].append(
                                step_metric["avg_response_time_hours"]
                            )
                        
                        all_step_metrics[step_num]["approval_counts"] += step_metric["approved_count"]
                        all_step_metrics[step_num]["rejection_counts"] += step_metric["rejected_count"]
                        
                except Exception as e:
                    logger.warning(f"Could not collect metrics for instance {instance['id']}: {e}")
                    continue
            
            # Calculate average metrics per step
            step_analysis = []
            for step_num, data in all_step_metrics.items():
                if data["response_times"]:
                    avg_response_time = sum(data["response_times"]) / len(data["response_times"])
                    
                    total_decisions = data["approval_counts"] + data["rejection_counts"]
                    rejection_rate = data["rejection_counts"] / total_decisions if total_decisions > 0 else 0
                    
                    step_analysis.append({
                        "step_number": step_num,
                        "avg_response_time_hours": round(avg_response_time, 2),
                        "total_approvals": data["approval_counts"],
                        "total_rejections": data["rejection_counts"],
                        "rejection_rate": round(rejection_rate, 4),
                        "instance_count": len(data["response_times"])
                    })
            
            # Sort by response time to identify bottlenecks
            step_analysis.sort(key=lambda x: x["avg_response_time_hours"], reverse=True)
            
            # Calculate overall average
            if workflow_durations:
                avg_workflow_duration = sum(workflow_durations) / len(workflow_durations)
            else:
                avg_workflow_duration = 0
            
            # Identify bottlenecks (steps significantly slower than average)
            bottlenecks = []
            if step_analysis and avg_workflow_duration > 0:
                for step in step_analysis:
                    # Consider a bottleneck if step takes more than 30% of total workflow time
                    if step["avg_response_time_hours"] > avg_workflow_duration * 0.3:
                        bottlenecks.append({
                            **step,
                            "severity": "high" if step["avg_response_time_hours"] > avg_workflow_duration * 0.5 else "medium",
                            "recommendation": self._generate_bottleneck_recommendation(step)
                        })
            
            return {
                "organization_id": organization_id,
                "workflow_id": workflow_id,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "total_instances": len(instances),
                "avg_workflow_duration_hours": round(avg_workflow_duration, 2),
                "step_analysis": step_analysis,
                "bottlenecks": bottlenecks,
                "analyzed_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error identifying workflow bottlenecks: {e}")
            raise RuntimeError(f"Failed to identify workflow bottlenecks: {str(e)}")
    
    def _generate_bottleneck_recommendation(self, step_metrics: Dict[str, Any]) -> str:
        """
        Generate recommendation for addressing a bottleneck.
        
        Args:
            step_metrics: Metrics for the bottleneck step
            
        Returns:
            Recommendation string
        """
        recommendations = []
        
        if step_metrics["avg_response_time_hours"] > 48:
            recommendations.append("Consider adding more approvers to this step")
        
        if step_metrics["rejection_rate"] > 0.3:
            recommendations.append("High rejection rate indicates unclear requirements or insufficient preparation")
        
        if step_metrics["instance_count"] > 10 and step_metrics["avg_response_time_hours"] > 24:
            recommendations.append("Implement automated reminders for pending approvals")
        
        if not recommendations:
            recommendations.append("Monitor this step closely and consider process optimization")
        
        return "; ".join(recommendations)
