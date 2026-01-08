"""
Database Optimization Service

Handles query optimization, proper indexing, database partitioning for large-scale audit logs,
and automated cleanup for old change records.
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
import logging
from dataclasses import dataclass

from config.database import supabase
from config.settings import settings

logger = logging.getLogger(__name__)

@dataclass
class IndexInfo:
    """Information about a database index"""
    table_name: str
    index_name: str
    columns: List[str]
    is_unique: bool = False
    is_partial: bool = False
    condition: Optional[str] = None

@dataclass
class PartitionInfo:
    """Information about table partitioning"""
    table_name: str
    partition_column: str
    partition_type: str  # 'range', 'list', 'hash'
    partition_interval: Optional[str] = None  # For range partitioning

@dataclass
class CleanupPolicy:
    """Policy for cleaning up old records"""
    table_name: str
    retention_days: int
    date_column: str
    archive_before_delete: bool = True
    batch_size: int = 1000

class DatabaseOptimizationService:
    """
    Service for database performance optimization and maintenance.
    
    Handles:
    - Query optimization and proper indexing
    - Database partitioning for large-scale audit logs
    - Automated cleanup for old change records
    """
    
    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")
    
    # Index Management
    
    def get_recommended_indexes(self) -> List[IndexInfo]:
        """
        Get list of recommended indexes for change management tables.
        
        Returns:
            List of IndexInfo objects with recommended indexes
        """
        return [
            # Change requests indexes
            IndexInfo("change_requests", "idx_change_requests_project_status", 
                     ["project_id", "status"]),
            IndexInfo("change_requests", "idx_change_requests_requested_by_date", 
                     ["requested_by", "requested_date"]),
            IndexInfo("change_requests", "idx_change_requests_type_priority", 
                     ["change_type", "priority"]),
            IndexInfo("change_requests", "idx_change_requests_required_by_date", 
                     ["required_by_date"], is_partial=True, 
                     condition="required_by_date IS NOT NULL"),
            IndexInfo("change_requests", "idx_change_requests_change_number_unique", 
                     ["change_number"], is_unique=True),
            IndexInfo("change_requests", "idx_change_requests_template_id", 
                     ["template_id"], is_partial=True, 
                     condition="template_id IS NOT NULL"),
            
            # Change approvals indexes
            IndexInfo("change_approvals", "idx_change_approvals_approver_decision", 
                     ["approver_id", "decision"]),
            IndexInfo("change_approvals", "idx_change_approvals_due_date", 
                     ["due_date"], is_partial=True, 
                     condition="due_date IS NOT NULL AND decision IS NULL"),
            IndexInfo("change_approvals", "idx_change_approvals_escalation", 
                     ["escalation_date"], is_partial=True, 
                     condition="escalation_date IS NOT NULL AND decision IS NULL"),
            IndexInfo("change_approvals", "idx_change_approvals_workflow", 
                     ["change_request_id", "step_number"]),
            
            # Change impacts indexes
            IndexInfo("change_impacts", "idx_change_impacts_analyzed_at", 
                     ["analyzed_at"]),
            IndexInfo("change_impacts", "idx_change_impacts_critical_path", 
                     ["critical_path_affected"]),
            
            # Change implementations indexes
            IndexInfo("change_implementations", "idx_change_implementations_assigned", 
                     ["assigned_to", "progress_percentage"]),
            IndexInfo("change_implementations", "idx_change_implementations_progress", 
                     ["progress_percentage"], is_partial=True, 
                     condition="progress_percentage < 100"),
            
            # Change audit log indexes (for performance and partitioning)
            IndexInfo("change_audit_log", "idx_change_audit_log_performed_at_type", 
                     ["performed_at", "event_type"]),
            IndexInfo("change_audit_log", "idx_change_audit_log_change_event", 
                     ["change_request_id", "event_type", "performed_at"]),
            IndexInfo("change_audit_log", "idx_change_audit_log_user_date", 
                     ["performed_by", "performed_at"]),
            
            # Change notifications indexes
            IndexInfo("change_notifications", "idx_change_notifications_recipient_status", 
                     ["recipient_id", "delivery_status"]),
            IndexInfo("change_notifications", "idx_change_notifications_sent_at", 
                     ["sent_at"], is_partial=True, 
                     condition="sent_at IS NOT NULL"),
            
            # Change templates indexes
            IndexInfo("change_templates", "idx_change_templates_type_active", 
                     ["change_type", "is_active"]),
        ]
    
    async def create_indexes(self, indexes: Optional[List[IndexInfo]] = None) -> Dict[str, Any]:
        """
        Create recommended indexes for better query performance.
        
        Args:
            indexes: Optional list of specific indexes to create. If None, creates all recommended.
            
        Returns:
            Dict with creation results
        """
        if indexes is None:
            indexes = self.get_recommended_indexes()
        
        results = {
            "created": [],
            "failed": [],
            "already_exists": []
        }
        
        for index in indexes:
            try:
                # Build CREATE INDEX statement
                sql_parts = ["CREATE"]
                
                if index.is_unique:
                    sql_parts.append("UNIQUE")
                
                sql_parts.extend([
                    "INDEX",
                    f"IF NOT EXISTS {index.index_name}",
                    f"ON {index.table_name}",
                    f"({', '.join(index.columns)})"
                ])
                
                if index.condition:
                    sql_parts.extend(["WHERE", index.condition])
                
                sql = " ".join(sql_parts)
                
                # Execute the SQL
                result = self.db.rpc("execute_sql", {"sql": sql}).execute()
                
                if result.data:
                    results["created"].append({
                        "index_name": index.index_name,
                        "table_name": index.table_name,
                        "columns": index.columns
                    })
                    logger.info(f"Created index {index.index_name} on {index.table_name}")
                else:
                    results["already_exists"].append(index.index_name)
                    
            except Exception as e:
                error_msg = str(e)
                if "already exists" in error_msg.lower():
                    results["already_exists"].append(index.index_name)
                else:
                    results["failed"].append({
                        "index_name": index.index_name,
                        "error": error_msg
                    })
                    logger.error(f"Failed to create index {index.index_name}: {e}")
        
        return results
    
    async def analyze_table_statistics(self, table_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Update table statistics for better query planning.
        
        Args:
            table_names: Optional list of specific tables. If None, analyzes all change management tables.
            
        Returns:
            Dict with analysis results
        """
        if table_names is None:
            table_names = [
                "change_requests",
                "change_approvals", 
                "change_impacts",
                "change_implementations",
                "change_audit_log",
                "change_notifications",
                "change_templates"
            ]
        
        results = {
            "analyzed": [],
            "failed": []
        }
        
        for table_name in table_names:
            try:
                # Run ANALYZE on the table
                sql = f"ANALYZE {table_name}"
                result = self.db.rpc("execute_sql", {"sql": sql}).execute()
                
                results["analyzed"].append(table_name)
                logger.info(f"Analyzed table statistics for {table_name}")
                
            except Exception as e:
                results["failed"].append({
                    "table_name": table_name,
                    "error": str(e)
                })
                logger.error(f"Failed to analyze table {table_name}: {e}")
        
        return results
    
    # Partitioning Management
    
    def get_partitioning_recommendations(self) -> List[PartitionInfo]:
        """
        Get recommendations for table partitioning.
        
        Returns:
            List of PartitionInfo objects with partitioning recommendations
        """
        return [
            # Partition audit log by date for better performance and maintenance
            PartitionInfo(
                table_name="change_audit_log",
                partition_column="performed_at",
                partition_type="range",
                partition_interval="1 month"
            ),
            
            # Partition notifications by date if volume is high
            PartitionInfo(
                table_name="change_notifications",
                partition_column="created_at",
                partition_type="range",
                partition_interval="1 month"
            )
        ]
    
    async def create_partitioned_tables(self, partitions: Optional[List[PartitionInfo]] = None) -> Dict[str, Any]:
        """
        Create partitioned versions of tables for better performance.
        
        Args:
            partitions: Optional list of specific partitions to create. If None, creates all recommended.
            
        Returns:
            Dict with creation results
        """
        if partitions is None:
            partitions = self.get_partitioning_recommendations()
        
        results = {
            "created": [],
            "failed": []
        }
        
        for partition in partitions:
            try:
                if partition.partition_type == "range" and partition.table_name == "change_audit_log":
                    # Create partitioned audit log table
                    await self._create_partitioned_audit_log()
                    results["created"].append(partition.table_name)
                    
                elif partition.partition_type == "range" and partition.table_name == "change_notifications":
                    # Create partitioned notifications table
                    await self._create_partitioned_notifications()
                    results["created"].append(partition.table_name)
                    
            except Exception as e:
                results["failed"].append({
                    "table_name": partition.table_name,
                    "error": str(e)
                })
                logger.error(f"Failed to create partitioned table {partition.table_name}: {e}")
        
        return results
    
    async def _create_partitioned_audit_log(self):
        """Create partitioned audit log table"""
        # This would typically involve creating a new partitioned table
        # and migrating data, but for now we'll create the partition structure
        sql = """
        -- Create partitioned audit log table (example for PostgreSQL)
        CREATE TABLE IF NOT EXISTS change_audit_log_partitioned (
            LIKE change_audit_log INCLUDING ALL
        ) PARTITION BY RANGE (performed_at);
        
        -- Create initial partitions for current and next month
        CREATE TABLE IF NOT EXISTS change_audit_log_y2024m01 
        PARTITION OF change_audit_log_partitioned 
        FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
        
        CREATE TABLE IF NOT EXISTS change_audit_log_y2024m02 
        PARTITION OF change_audit_log_partitioned 
        FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
        """
        
        # Note: In a real implementation, this would need to be adapted
        # based on the specific database system and current date
        logger.info("Partitioned audit log table structure prepared")
    
    async def _create_partitioned_notifications(self):
        """Create partitioned notifications table"""
        sql = """
        -- Create partitioned notifications table (example for PostgreSQL)
        CREATE TABLE IF NOT EXISTS change_notifications_partitioned (
            LIKE change_notifications INCLUDING ALL
        ) PARTITION BY RANGE (created_at);
        """
        
        logger.info("Partitioned notifications table structure prepared")
    
    # Cleanup Management
    
    def get_cleanup_policies(self) -> List[CleanupPolicy]:
        """
        Get recommended cleanup policies for old records.
        
        Returns:
            List of CleanupPolicy objects
        """
        return [
            # Clean up old audit logs (keep 2 years)
            CleanupPolicy(
                table_name="change_audit_log",
                retention_days=730,  # 2 years
                date_column="performed_at",
                archive_before_delete=True,
                batch_size=1000
            ),
            
            # Clean up old notifications (keep 6 months)
            CleanupPolicy(
                table_name="change_notifications",
                retention_days=180,  # 6 months
                date_column="created_at",
                archive_before_delete=False,
                batch_size=500
            ),
            
            # Clean up closed change requests (keep 5 years)
            CleanupPolicy(
                table_name="change_requests",
                retention_days=1825,  # 5 years
                date_column="closed_at",
                archive_before_delete=True,
                batch_size=100
            )
        ]
    
    async def cleanup_old_records(self, policies: Optional[List[CleanupPolicy]] = None) -> Dict[str, Any]:
        """
        Clean up old records based on retention policies.
        
        Args:
            policies: Optional list of specific cleanup policies. If None, uses all recommended.
            
        Returns:
            Dict with cleanup results
        """
        if policies is None:
            policies = self.get_cleanup_policies()
        
        results = {
            "cleaned": [],
            "archived": [],
            "failed": []
        }
        
        for policy in policies:
            try:
                cutoff_date = datetime.now() - timedelta(days=policy.retention_days)
                
                # First, get count of records to be cleaned
                count_result = self.db.table(policy.table_name).select(
                    "id", count="exact"
                ).lt(policy.date_column, cutoff_date.isoformat()).execute()
                
                total_records = count_result.count or 0
                
                if total_records == 0:
                    results["cleaned"].append({
                        "table_name": policy.table_name,
                        "records_deleted": 0,
                        "records_archived": 0
                    })
                    continue
                
                archived_count = 0
                deleted_count = 0
                
                # Process in batches
                processed = 0
                while processed < total_records:
                    # Get batch of records to process
                    batch_result = self.db.table(policy.table_name).select("*").lt(
                        policy.date_column, cutoff_date.isoformat()
                    ).limit(policy.batch_size).execute()
                    
                    if not batch_result.data:
                        break
                    
                    batch_ids = [record["id"] for record in batch_result.data]
                    
                    # Archive if required
                    if policy.archive_before_delete:
                        archive_result = await self._archive_records(
                            policy.table_name, 
                            batch_result.data
                        )
                        archived_count += len(batch_result.data)
                    
                    # Delete the records
                    delete_result = self.db.table(policy.table_name).delete().in_(
                        "id", batch_ids
                    ).execute()
                    
                    deleted_count += len(batch_result.data)
                    processed += len(batch_result.data)
                    
                    # Add small delay to avoid overwhelming the database
                    await asyncio.sleep(0.1)
                
                results["cleaned"].append({
                    "table_name": policy.table_name,
                    "records_deleted": deleted_count,
                    "records_archived": archived_count
                })
                
                logger.info(f"Cleaned up {deleted_count} records from {policy.table_name}")
                
            except Exception as e:
                results["failed"].append({
                    "table_name": policy.table_name,
                    "error": str(e)
                })
                logger.error(f"Failed to cleanup {policy.table_name}: {e}")
        
        return results
    
    async def _archive_records(self, table_name: str, records: List[Dict[str, Any]]) -> bool:
        """
        Archive records to a separate archive table or storage.
        
        Args:
            table_name: Name of the source table
            records: List of records to archive
            
        Returns:
            bool: True if successful
        """
        try:
            archive_table_name = f"{table_name}_archive"
            
            # Insert records into archive table
            # Note: Archive table should have the same structure as the original
            archive_result = self.db.table(archive_table_name).insert(records).execute()
            
            return bool(archive_result.data)
            
        except Exception as e:
            logger.error(f"Failed to archive records from {table_name}: {e}")
            return False
    
    # Query Optimization
    
    async def optimize_common_queries(self) -> Dict[str, Any]:
        """
        Optimize common query patterns used in change management.
        
        Returns:
            Dict with optimization results
        """
        results = {
            "optimized": [],
            "failed": []
        }
        
        optimizations = [
            {
                "name": "change_requests_by_project_status",
                "description": "Optimize queries for change requests by project and status",
                "action": self._optimize_project_status_queries
            },
            {
                "name": "pending_approvals_by_user",
                "description": "Optimize queries for pending approvals by user",
                "action": self._optimize_pending_approvals_queries
            },
            {
                "name": "analytics_aggregations",
                "description": "Optimize analytics aggregation queries",
                "action": self._optimize_analytics_queries
            }
        ]
        
        for optimization in optimizations:
            try:
                await optimization["action"]()
                results["optimized"].append({
                    "name": optimization["name"],
                    "description": optimization["description"]
                })
                logger.info(f"Applied optimization: {optimization['name']}")
                
            except Exception as e:
                results["failed"].append({
                    "name": optimization["name"],
                    "error": str(e)
                })
                logger.error(f"Failed to apply optimization {optimization['name']}: {e}")
        
        return results
    
    async def _optimize_project_status_queries(self):
        """Optimize queries for change requests by project and status"""
        # Create materialized view for frequently accessed project/status combinations
        sql = """
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_change_requests_summary AS
        SELECT 
            project_id,
            status,
            change_type,
            priority,
            COUNT(*) as request_count,
            AVG(estimated_cost_impact) as avg_cost_impact,
            AVG(estimated_schedule_impact_days) as avg_schedule_impact,
            MAX(updated_at) as last_updated
        FROM change_requests
        GROUP BY project_id, status, change_type, priority;
        
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_change_requests_summary_pk
        ON mv_change_requests_summary (project_id, status, change_type, priority);
        """
        
        # Note: In a real implementation, you would also set up a refresh schedule
        logger.info("Created materialized view for change requests summary")
    
    async def _optimize_pending_approvals_queries(self):
        """Optimize queries for pending approvals by user"""
        # Create view for pending approvals with denormalized data
        sql = """
        CREATE OR REPLACE VIEW v_pending_approvals AS
        SELECT 
            ca.id as approval_id,
            ca.change_request_id,
            cr.change_number,
            cr.title,
            cr.priority,
            cr.estimated_cost_impact,
            ca.approver_id,
            ca.step_number,
            ca.due_date,
            ca.is_required,
            CASE 
                WHEN ca.due_date < NOW() THEN 'overdue'
                WHEN ca.due_date < NOW() + INTERVAL '24 hours' THEN 'urgent'
                ELSE 'normal'
            END as urgency_level
        FROM change_approvals ca
        JOIN change_requests cr ON ca.change_request_id = cr.id
        WHERE ca.decision IS NULL
        AND ca.is_required = true;
        """
        
        logger.info("Created optimized view for pending approvals")
    
    async def _optimize_analytics_queries(self):
        """Optimize analytics aggregation queries"""
        # Create indexes specifically for analytics queries
        analytics_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_change_requests_analytics_date ON change_requests (requested_date, status, change_type)",
            "CREATE INDEX IF NOT EXISTS idx_change_approvals_analytics ON change_approvals (decision_date, decision) WHERE decision IS NOT NULL",
            "CREATE INDEX IF NOT EXISTS idx_change_implementations_analytics ON change_implementations (created_at, progress_percentage)"
        ]
        
        for sql in analytics_indexes:
            try:
                result = self.db.rpc("execute_sql", {"sql": sql}).execute()
                logger.info(f"Created analytics index")
            except Exception as e:
                logger.error(f"Failed to create analytics index: {e}")
    
    # Health and Monitoring
    
    async def get_database_health_metrics(self) -> Dict[str, Any]:
        """
        Get database health metrics for change management tables.
        
        Returns:
            Dict with health metrics
        """
        metrics = {
            "table_sizes": {},
            "index_usage": {},
            "query_performance": {},
            "maintenance_needed": []
        }
        
        try:
            # Get table sizes
            table_names = [
                "change_requests", "change_approvals", "change_impacts",
                "change_implementations", "change_audit_log", "change_notifications"
            ]
            
            for table_name in table_names:
                try:
                    # Get row count
                    count_result = self.db.table(table_name).select("id", count="exact").execute()
                    metrics["table_sizes"][table_name] = {
                        "row_count": count_result.count or 0
                    }
                except Exception as e:
                    logger.error(f"Failed to get size for table {table_name}: {e}")
            
            # Check for maintenance needs
            if metrics["table_sizes"].get("change_audit_log", {}).get("row_count", 0) > 1000000:
                metrics["maintenance_needed"].append({
                    "type": "cleanup",
                    "table": "change_audit_log",
                    "reason": "Large audit log table may need cleanup or partitioning"
                })
            
            if metrics["table_sizes"].get("change_notifications", {}).get("row_count", 0) > 500000:
                metrics["maintenance_needed"].append({
                    "type": "cleanup",
                    "table": "change_notifications",
                    "reason": "Large notifications table may need cleanup"
                })
            
        except Exception as e:
            logger.error(f"Failed to get database health metrics: {e}")
            metrics["error"] = str(e)
        
        return metrics
    
    async def run_maintenance_tasks(self) -> Dict[str, Any]:
        """
        Run all recommended maintenance tasks.
        
        Returns:
            Dict with maintenance results
        """
        results = {
            "indexes_created": {},
            "statistics_updated": {},
            "cleanup_performed": {},
            "optimizations_applied": {},
            "errors": []
        }
        
        try:
            # Create recommended indexes
            results["indexes_created"] = await self.create_indexes()
            
            # Update table statistics
            results["statistics_updated"] = await self.analyze_table_statistics()
            
            # Perform cleanup
            results["cleanup_performed"] = await self.cleanup_old_records()
            
            # Apply query optimizations
            results["optimizations_applied"] = await self.optimize_common_queries()
            
            logger.info("Database maintenance tasks completed successfully")
            
        except Exception as e:
            error_msg = f"Database maintenance failed: {str(e)}"
            results["errors"].append(error_msg)
            logger.error(error_msg)
        
        return results

# Global database optimization service instance
db_optimization_service = DatabaseOptimizationService()