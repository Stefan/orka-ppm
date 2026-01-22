"""
Workflow Reporting Service

Provides comprehensive reporting capabilities for workflow analytics including
usage patterns, performance trends, and data export functionality.
"""

import logging
import csv
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from io import StringIO
from uuid import UUID

from config.database import supabase
from services.workflow_analytics_service import WorkflowAnalyticsService

logger = logging.getLogger(__name__)


class WorkflowReportingService:
    """
    Service for generating workflow reports and analyzing usage patterns.
    
    Provides:
    - Workflow usage pattern reports
    - Performance trend analysis
    - Data export in multiple formats (JSON, CSV)
    - Executive summaries
    """
    
    def __init__(self):
        """Initialize the workflow reporting service."""
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
        
        self.analytics_service = WorkflowAnalyticsService()
    
    async def generate_usage_pattern_report(
        self,
        organization_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate workflow usage pattern report.
        
        Args:
            organization_id: Organization ID for filtering
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            Dict containing usage patterns including workflow frequency,
            popular workflows, and usage trends over time
            
        Raises:
            RuntimeError: If report generation fails
        """
        try:
            # Default to last 30 days if no dates provided
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Get all workflow instances in date range
            instances_result = self.db.table("workflow_instances").select(
                "*, workflows(name, description)"
            ).gte("started_at", start_date.isoformat()).lte(
                "started_at", end_date.isoformat()
            ).execute()
            
            # Filter by organization
            instances = [
                i for i in instances_result.data
                if i.get("data", {}).get("organization_id") == organization_id
            ]
            
            if not instances:
                return {
                    "organization_id": organization_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "total_workflows": 0,
                    "usage_patterns": {}
                }
            
            # Analyze usage patterns
            workflow_usage = {}
            status_counts = {
                "completed": 0,
                "rejected": 0,
                "pending": 0,
                "in_progress": 0
            }
            entity_type_counts = {}
            daily_usage = {}
            
            for instance in instances:
                workflow_id = instance["workflow_id"]
                workflow_name = instance.get("workflows", {}).get("name", "Unknown")
                
                # Count by workflow
                if workflow_id not in workflow_usage:
                    workflow_usage[workflow_id] = {
                        "workflow_id": workflow_id,
                        "workflow_name": workflow_name,
                        "usage_count": 0,
                        "completed_count": 0,
                        "rejected_count": 0,
                        "pending_count": 0,
                        "in_progress_count": 0,
                        "avg_duration_hours": 0,
                        "durations": []
                    }
                
                workflow_usage[workflow_id]["usage_count"] += 1
                
                # Count by status
                status = instance["status"]
                if status in status_counts:
                    status_counts[status] += 1
                    workflow_usage[workflow_id][f"{status}_count"] += 1
                
                # Count by entity type
                entity_type = instance.get("entity_type", "unknown")
                entity_type_counts[entity_type] = entity_type_counts.get(entity_type, 0) + 1
                
                # Track daily usage
                started_date = instance["started_at"][:10]  # Extract date part
                daily_usage[started_date] = daily_usage.get(started_date, 0) + 1
                
                # Calculate duration if completed
                if instance.get("completed_at"):
                    started_at = datetime.fromisoformat(instance["started_at"].replace("Z", "+00:00"))
                    completed_at = datetime.fromisoformat(instance["completed_at"].replace("Z", "+00:00"))
                    duration_hours = (completed_at - started_at).total_seconds() / 3600
                    workflow_usage[workflow_id]["durations"].append(duration_hours)
            
            # Calculate average durations
            for wf_id, data in workflow_usage.items():
                if data["durations"]:
                    data["avg_duration_hours"] = round(
                        sum(data["durations"]) / len(data["durations"]), 2
                    )
                del data["durations"]  # Remove raw data
            
            # Sort workflows by usage
            popular_workflows = sorted(
                workflow_usage.values(),
                key=lambda x: x["usage_count"],
                reverse=True
            )
            
            # Calculate completion rate
            total_instances = len(instances)
            completion_rate = status_counts["completed"] / total_instances if total_instances > 0 else 0
            rejection_rate = status_counts["rejected"] / total_instances if total_instances > 0 else 0
            
            # Identify usage trends
            sorted_daily = sorted(daily_usage.items())
            usage_trend = "stable"
            if len(sorted_daily) >= 7:
                # Compare first week to last week
                first_week_avg = sum(count for _, count in sorted_daily[:7]) / 7
                last_week_avg = sum(count for _, count in sorted_daily[-7:]) / 7
                
                if last_week_avg > first_week_avg * 1.2:
                    usage_trend = "increasing"
                elif last_week_avg < first_week_avg * 0.8:
                    usage_trend = "decreasing"
            
            return {
                "organization_id": organization_id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_workflows": total_instances,
                "status_distribution": status_counts,
                "completion_rate": round(completion_rate, 4),
                "rejection_rate": round(rejection_rate, 4),
                "entity_type_distribution": entity_type_counts,
                "popular_workflows": popular_workflows[:10],  # Top 10
                "daily_usage": sorted_daily,
                "usage_trend": usage_trend,
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating usage pattern report: {e}")
            raise RuntimeError(f"Failed to generate usage pattern report: {str(e)}")
    
    async def generate_performance_trend_report(
        self,
        organization_id: str,
        workflow_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate workflow performance trend analysis report.
        
        Args:
            organization_id: Organization ID for filtering
            workflow_id: Optional specific workflow ID to analyze
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            Dict containing performance trends including duration trends,
            approval time trends, and efficiency improvements over time
            
        Raises:
            RuntimeError: If report generation fails
        """
        try:
            # Default to last 90 days if no dates provided
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=90)
            
            # Get workflow instances
            query = self.db.table("workflow_instances").select("*").gte(
                "started_at", start_date.isoformat()
            ).lte("started_at", end_date.isoformat())
            
            if workflow_id:
                query = query.eq("workflow_id", workflow_id)
            
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
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "total_instances": 0,
                    "trends": {}
                }
            
            # Group instances by week for trend analysis
            weekly_metrics = {}
            
            for instance in instances:
                # Get week start date
                started_at = datetime.fromisoformat(instance["started_at"].replace("Z", "+00:00"))
                week_start = (started_at - timedelta(days=started_at.weekday())).date().isoformat()
                
                if week_start not in weekly_metrics:
                    weekly_metrics[week_start] = {
                        "week_start": week_start,
                        "instance_count": 0,
                        "completed_count": 0,
                        "rejected_count": 0,
                        "durations": [],
                        "avg_duration_hours": 0
                    }
                
                weekly_metrics[week_start]["instance_count"] += 1
                
                if instance["status"] == "completed":
                    weekly_metrics[week_start]["completed_count"] += 1
                    
                    if instance.get("completed_at"):
                        completed_at = datetime.fromisoformat(instance["completed_at"].replace("Z", "+00:00"))
                        duration_hours = (completed_at - started_at).total_seconds() / 3600
                        weekly_metrics[week_start]["durations"].append(duration_hours)
                
                elif instance["status"] == "rejected":
                    weekly_metrics[week_start]["rejected_count"] += 1
            
            # Calculate weekly averages
            for week, metrics in weekly_metrics.items():
                if metrics["durations"]:
                    metrics["avg_duration_hours"] = round(
                        sum(metrics["durations"]) / len(metrics["durations"]), 2
                    )
                del metrics["durations"]
                
                # Calculate completion rate
                metrics["completion_rate"] = round(
                    metrics["completed_count"] / metrics["instance_count"]
                    if metrics["instance_count"] > 0 else 0, 4
                )
            
            # Sort by week
            sorted_weeks = sorted(weekly_metrics.values(), key=lambda x: x["week_start"])
            
            # Calculate overall trends
            if len(sorted_weeks) >= 2:
                # Duration trend
                first_half_durations = [
                    w["avg_duration_hours"] for w in sorted_weeks[:len(sorted_weeks)//2]
                    if w["avg_duration_hours"] > 0
                ]
                second_half_durations = [
                    w["avg_duration_hours"] for w in sorted_weeks[len(sorted_weeks)//2:]
                    if w["avg_duration_hours"] > 0
                ]
                
                if first_half_durations and second_half_durations:
                    first_avg = sum(first_half_durations) / len(first_half_durations)
                    second_avg = sum(second_half_durations) / len(second_half_durations)
                    
                    duration_improvement = ((first_avg - second_avg) / first_avg * 100) if first_avg > 0 else 0
                else:
                    duration_improvement = 0
                
                # Completion rate trend
                first_half_completion = [
                    w["completion_rate"] for w in sorted_weeks[:len(sorted_weeks)//2]
                ]
                second_half_completion = [
                    w["completion_rate"] for w in sorted_weeks[len(sorted_weeks)//2:]
                ]
                
                if first_half_completion and second_half_completion:
                    first_comp_avg = sum(first_half_completion) / len(first_half_completion)
                    second_comp_avg = sum(second_half_completion) / len(second_half_completion)
                    
                    completion_improvement = ((second_comp_avg - first_comp_avg) / first_comp_avg * 100) if first_comp_avg > 0 else 0
                else:
                    completion_improvement = 0
            else:
                duration_improvement = 0
                completion_improvement = 0
            
            # Overall statistics
            total_completed = sum(w["completed_count"] for w in sorted_weeks)
            total_rejected = sum(w["rejected_count"] for w in sorted_weeks)
            total_instances = len(instances)
            
            overall_completion_rate = total_completed / total_instances if total_instances > 0 else 0
            overall_rejection_rate = total_rejected / total_instances if total_instances > 0 else 0
            
            return {
                "organization_id": organization_id,
                "workflow_id": workflow_id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_instances": total_instances,
                "overall_metrics": {
                    "completion_rate": round(overall_completion_rate, 4),
                    "rejection_rate": round(overall_rejection_rate, 4),
                    "total_completed": total_completed,
                    "total_rejected": total_rejected
                },
                "trends": {
                    "duration_improvement_percent": round(duration_improvement, 2),
                    "completion_improvement_percent": round(completion_improvement, 2),
                    "trend_direction": "improving" if duration_improvement > 5 or completion_improvement > 5 else "stable"
                },
                "weekly_metrics": sorted_weeks,
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating performance trend report: {e}")
            raise RuntimeError(f"Failed to generate performance trend report: {str(e)}")
    
    async def export_workflow_data(
        self,
        organization_id: str,
        format: str = "json",
        workflow_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_approvals: bool = True
    ) -> Dict[str, Any]:
        """
        Export workflow data for external analysis.
        
        Args:
            organization_id: Organization ID for filtering
            format: Export format ("json" or "csv")
            workflow_id: Optional specific workflow ID to export
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            include_approvals: Whether to include approval details
            
        Returns:
            Dict containing exported data in requested format
            
        Raises:
            ValueError: If invalid format specified
            RuntimeError: If export fails
        """
        try:
            if format not in ["json", "csv"]:
                raise ValueError(f"Invalid export format: {format}. Must be 'json' or 'csv'")
            
            # Default to last 90 days if no dates provided
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=90)
            
            # Get workflow instances
            query = self.db.table("workflow_instances").select(
                "*, workflows(name, description)"
            ).gte("started_at", start_date.isoformat()).lte(
                "started_at", end_date.isoformat()
            )
            
            if workflow_id:
                query = query.eq("workflow_id", workflow_id)
            
            instances_result = query.execute()
            
            # Filter by organization
            instances = [
                i for i in instances_result.data
                if i.get("data", {}).get("organization_id") == organization_id
            ]
            
            # Collect data for export
            export_data = []
            
            for instance in instances:
                instance_data = {
                    "instance_id": instance["id"],
                    "workflow_id": instance["workflow_id"],
                    "workflow_name": instance.get("workflows", {}).get("name", "Unknown"),
                    "entity_type": instance.get("entity_type"),
                    "entity_id": instance.get("entity_id"),
                    "status": instance["status"],
                    "current_step": instance.get("current_step"),
                    "started_by": instance.get("started_by"),
                    "started_at": instance["started_at"],
                    "completed_at": instance.get("completed_at"),
                    "created_at": instance["created_at"],
                    "updated_at": instance["updated_at"]
                }
                
                # Calculate duration if completed
                if instance.get("completed_at"):
                    started_at = datetime.fromisoformat(instance["started_at"].replace("Z", "+00:00"))
                    completed_at = datetime.fromisoformat(instance["completed_at"].replace("Z", "+00:00"))
                    instance_data["duration_hours"] = round(
                        (completed_at - started_at).total_seconds() / 3600, 2
                    )
                else:
                    instance_data["duration_hours"] = None
                
                # Include approval details if requested
                if include_approvals:
                    approvals_result = self.db.table("workflow_approvals").select("*").eq(
                        "workflow_instance_id", instance["id"]
                    ).execute()
                    
                    instance_data["approvals"] = [
                        {
                            "approval_id": a["id"],
                            "step_number": a["step_number"],
                            "approver_id": a["approver_id"],
                            "status": a["status"],
                            "comments": a.get("comments"),
                            "approved_at": a.get("approved_at"),
                            "created_at": a["created_at"]
                        }
                        for a in approvals_result.data
                    ]
                
                export_data.append(instance_data)
            
            # Format data based on requested format
            if format == "json":
                return {
                    "format": "json",
                    "organization_id": organization_id,
                    "workflow_id": workflow_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "record_count": len(export_data),
                    "data": export_data,
                    "exported_at": datetime.utcnow().isoformat()
                }
            
            elif format == "csv":
                # Flatten data for CSV export
                csv_data = []
                
                for item in export_data:
                    # Base instance data
                    row = {
                        "instance_id": item["instance_id"],
                        "workflow_id": item["workflow_id"],
                        "workflow_name": item["workflow_name"],
                        "entity_type": item["entity_type"],
                        "entity_id": item["entity_id"],
                        "status": item["status"],
                        "current_step": item["current_step"],
                        "started_by": item["started_by"],
                        "started_at": item["started_at"],
                        "completed_at": item["completed_at"],
                        "duration_hours": item["duration_hours"],
                        "created_at": item["created_at"],
                        "updated_at": item["updated_at"]
                    }
                    
                    if include_approvals and "approvals" in item:
                        # Add approval summary
                        row["total_approvals"] = len(item["approvals"])
                        row["approved_count"] = sum(1 for a in item["approvals"] if a["status"] == "approved")
                        row["rejected_count"] = sum(1 for a in item["approvals"] if a["status"] == "rejected")
                        row["pending_count"] = sum(1 for a in item["approvals"] if a["status"] == "pending")
                    
                    csv_data.append(row)
                
                # Generate CSV string
                if csv_data:
                    output = StringIO()
                    writer = csv.DictWriter(output, fieldnames=csv_data[0].keys())
                    writer.writeheader()
                    writer.writerows(csv_data)
                    csv_content = output.getvalue()
                else:
                    csv_content = ""
                
                return {
                    "format": "csv",
                    "organization_id": organization_id,
                    "workflow_id": workflow_id,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "record_count": len(csv_data),
                    "data": csv_content,
                    "exported_at": datetime.utcnow().isoformat()
                }
            
        except ValueError as e:
            logger.error(f"Validation error exporting workflow data: {e}")
            raise
        except Exception as e:
            logger.error(f"Error exporting workflow data: {e}")
            raise RuntimeError(f"Failed to export workflow data: {str(e)}")
    
    async def generate_executive_summary(
        self,
        organization_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate executive summary report for workflow performance.
        
        Args:
            organization_id: Organization ID for filtering
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            
        Returns:
            Dict containing high-level executive summary with key metrics,
            trends, and recommendations
            
        Raises:
            RuntimeError: If report generation fails
        """
        try:
            # Default to last 30 days if no dates provided
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Generate component reports
            usage_report = await self.generate_usage_pattern_report(
                organization_id, start_date, end_date
            )
            
            performance_report = await self.generate_performance_trend_report(
                organization_id, None, start_date, end_date
            )
            
            bottleneck_analysis = await self.analytics_service.identify_workflow_bottlenecks(
                organization_id, None, start_date, end_date
            )
            
            # Compile executive summary
            summary = {
                "organization_id": organization_id,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": (end_date - start_date).days
                },
                "key_metrics": {
                    "total_workflows": usage_report["total_workflows"],
                    "completion_rate": usage_report["completion_rate"],
                    "rejection_rate": usage_report["rejection_rate"],
                    "avg_workflow_duration_hours": bottleneck_analysis.get("avg_workflow_duration_hours", 0),
                    "usage_trend": usage_report["usage_trend"]
                },
                "performance_trends": {
                    "duration_improvement_percent": performance_report["trends"]["duration_improvement_percent"],
                    "completion_improvement_percent": performance_report["trends"]["completion_improvement_percent"],
                    "trend_direction": performance_report["trends"]["trend_direction"]
                },
                "top_workflows": usage_report["popular_workflows"][:5],
                "bottlenecks": {
                    "count": len(bottleneck_analysis["bottlenecks"]),
                    "critical_bottlenecks": [
                        b for b in bottleneck_analysis["bottlenecks"]
                        if b.get("severity") == "high"
                    ]
                },
                "recommendations": self._generate_executive_recommendations(
                    usage_report, performance_report, bottleneck_analysis
                ),
                "generated_at": datetime.utcnow().isoformat()
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Error generating executive summary: {e}")
            raise RuntimeError(f"Failed to generate executive summary: {str(e)}")
    
    def _generate_executive_recommendations(
        self,
        usage_report: Dict[str, Any],
        performance_report: Dict[str, Any],
        bottleneck_analysis: Dict[str, Any]
    ) -> List[str]:
        """
        Generate executive recommendations based on reports.
        
        Args:
            usage_report: Usage pattern report
            performance_report: Performance trend report
            bottleneck_analysis: Bottleneck analysis report
            
        Returns:
            List of recommendation strings
        """
        recommendations = []
        
        # Usage-based recommendations
        if usage_report["usage_trend"] == "increasing":
            recommendations.append(
                "Workflow usage is increasing. Consider scaling approval resources to maintain performance."
            )
        
        if usage_report["rejection_rate"] > 0.2:
            recommendations.append(
                f"High rejection rate ({usage_report['rejection_rate']:.1%}). "
                "Review workflow requirements and provide better guidance to initiators."
            )
        
        # Performance-based recommendations
        if performance_report["trends"]["trend_direction"] == "improving":
            recommendations.append(
                "Workflow performance is improving. Continue current optimization efforts."
            )
        elif performance_report["trends"]["duration_improvement_percent"] < -10:
            recommendations.append(
                "Workflow duration is increasing. Investigate causes and implement process improvements."
            )
        
        # Bottleneck-based recommendations
        if len(bottleneck_analysis["bottlenecks"]) > 0:
            critical_count = len([
                b for b in bottleneck_analysis["bottlenecks"]
                if b.get("severity") == "high"
            ])
            
            if critical_count > 0:
                recommendations.append(
                    f"Found {critical_count} critical bottleneck(s). "
                    "Prioritize addressing these to improve overall workflow efficiency."
                )
        
        # General recommendations
        if usage_report["completion_rate"] < 0.7:
            recommendations.append(
                "Low completion rate. Review pending workflows and implement automated reminders."
            )
        
        if not recommendations:
            recommendations.append(
                "Workflow system is performing well. Continue monitoring key metrics."
            )
        
        return recommendations
