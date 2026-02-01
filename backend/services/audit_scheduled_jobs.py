"""
Audit Trail Scheduled Jobs

This module implements the scheduled job functions for the AI-Empowered Audit Trail feature.
These jobs are executed by the AuditScheduler at configured intervals.

Requirements: 1.1, 1.4, 1.5, 1.6, 3.10, 4.11, 5.9, 5.10
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
import asyncio

from config.database import supabase
from services.audit_anomaly_service import AuditAnomalyService
from services.audit_integration_hub import AuditIntegrationHub
from services.audit_rag_agent import AuditRAGAgent
from services.audit_ml_service import AuditMLService
from services.audit_export_service import AuditExportService

logger = logging.getLogger(__name__)


class AuditScheduledJobs:
    """
    Container for all scheduled job implementations.
    
    Provides async functions that can be registered with the AuditScheduler.
    """
    
    def __init__(
        self,
        supabase_client=None,
        redis_client=None,
        openai_api_key: Optional[str] = None
    ):
        """
        Initialize scheduled jobs with required services.
        
        Args:
            supabase_client: Supabase client for database operations
            redis_client: Redis client for caching
            openai_api_key: OpenAI API key for AI services
        """
        self.supabase = supabase_client or supabase
        self.redis = redis_client
        self.openai_api_key = openai_api_key
        
        # Initialize services
        self.anomaly_service = AuditAnomalyService(
            supabase_client=self.supabase,
            redis_client=self.redis
        )
        self.integration_hub = AuditIntegrationHub(supabase_client=self.supabase)
        self.rag_agent = AuditRAGAgent(
            supabase_client=self.supabase,
            openai_api_key=self.openai_api_key,
            redis_client=self.redis
        )
        self.ml_service = AuditMLService(supabase_client=self.supabase)
        self.export_service = AuditExportService(
            supabase_client=self.supabase,
            openai_api_key=self.openai_api_key
        )
        
        logger.info("AuditScheduledJobs initialized")
    
    async def run_anomaly_detection(self):
        """
        Scheduled job for anomaly detection.
        
        Scans last 24 hours of audit events, detects anomalies,
        generates alerts, and sends notifications via Integration Hub.
        
        Requirements: 1.1, 1.4, 1.5
        """
        try:
            logger.info("Starting scheduled anomaly detection job")
            
            # Define time range (last 24 hours)
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=24)
            
            # Detect anomalies
            anomalies = await self.anomaly_service.detect_anomalies(
                start_time=start_time,
                end_time=end_time
            )
            
            logger.info(f"Detected {len(anomalies)} anomalies in last 24 hours")
            
            # Generate alerts and send notifications for each anomaly
            for anomaly in anomalies:
                try:
                    # Generate alert
                    alert = await self.anomaly_service.generate_alert(anomaly)
                    logger.info(f"Generated alert for anomaly {anomaly.id}")
                    
                    # Send notifications via configured integrations
                    await self._send_anomaly_notifications(anomaly)
                    
                except Exception as e:
                    logger.error(f"Failed to process anomaly {anomaly.id}: {str(e)}")
                    continue
            
            logger.info("Completed scheduled anomaly detection job")
            
        except Exception as e:
            logger.error(f"Anomaly detection job failed: {str(e)}")
            raise
    
    async def _send_anomaly_notifications(self, anomaly):
        """
        Send notifications for detected anomaly via all configured integrations.
        
        Args:
            anomaly: AnomalyDetection object
        """
        try:
            # Get tenant ID from anomaly event
            tenant_id = anomaly.audit_event.get('tenant_id')
            if not tenant_id:
                logger.warning(f"No tenant_id for anomaly {anomaly.id}, skipping notifications")
                return
            
            # Fetch active integrations for tenant
            response = self.supabase.table("audit_integrations").select("*").eq(
                "tenant_id", str(tenant_id)
            ).eq("is_active", True).execute()
            
            integrations = response.data if response.data else []
            
            if not integrations:
                logger.info(f"No active integrations for tenant {tenant_id}")
                return
            
            # Send notifications to each integration
            for integration in integrations:
                integration_type = integration['integration_type']
                config = integration['config']
                
                try:
                    if integration_type == 'slack':
                        webhook_url = config.get('webhook_url')
                        if webhook_url:
                            result = await self.integration_hub.send_slack_notification(
                                anomaly=anomaly.__dict__,
                                webhook_url=webhook_url
                            )
                            logger.info(f"Slack notification result: {result.success}")
                    
                    elif integration_type == 'teams':
                        webhook_url = config.get('webhook_url')
                        if webhook_url:
                            result = await self.integration_hub.send_teams_notification(
                                anomaly=anomaly.__dict__,
                                webhook_url=webhook_url
                            )
                            logger.info(f"Teams notification result: {result.success}")
                    
                    elif integration_type == 'zapier':
                        webhook_url = config.get('webhook_url')
                        if webhook_url:
                            result = await self.integration_hub.trigger_zapier_webhook(
                                anomaly=anomaly.__dict__,
                                webhook_url=webhook_url
                            )
                            logger.info(f"Zapier notification result: {result.success}")
                    
                except Exception as e:
                    logger.error(f"Failed to send {integration_type} notification: {str(e)}")
                    continue
            
            # Mark alert as sent
            await self._mark_alert_sent(anomaly.id)
            
        except Exception as e:
            logger.error(f"Failed to send notifications for anomaly {anomaly.id}: {str(e)}")
    
    async def _mark_alert_sent(self, anomaly_id: UUID):
        """Mark anomaly alert as sent in database."""
        try:
            self.supabase.table("audit_anomalies").update({
                "alert_sent": True
            }).eq("id", str(anomaly_id)).execute()
        except Exception as e:
            logger.error(f"Failed to mark alert as sent: {str(e)}")
    
    async def run_embedding_generation(self):
        """
        Scheduled job for embedding generation.
        
        Processes audit events without embeddings and generates
        vector embeddings for semantic search.
        
        Requirements: 3.10
        """
        try:
            logger.info("Starting scheduled embedding generation job")
            
            # Fetch events without embeddings (batch of 100)
            response = self.supabase.table("audit_logs").select(
                "id, event_type, action_details, user_id, entity_type, timestamp"
            ).is_("embedding_id", "null").limit(100).execute()
            
            events = response.data if response.data else []
            
            if not events:
                logger.info("No events without embeddings found")
                return
            
            logger.info(f"Generating embeddings for {len(events)} events")
            
            # Generate embeddings for each event
            success_count = 0
            for event in events:
                try:
                    # Index event (generates and stores embedding)
                    success = await self.rag_agent.index_audit_event(event)
                    if success:
                        success_count += 1
                except Exception as e:
                    logger.error(f"Failed to generate embedding for event {event['id']}: {str(e)}")
                    continue
            
            logger.info(f"Successfully generated {success_count}/{len(events)} embeddings")
            
        except Exception as e:
            logger.error(f"Embedding generation job failed: {str(e)}")
            raise
    
    async def run_anomaly_model_training(self):
        """
        Scheduled job for anomaly detector model training.
        
        Retrains the Isolation Forest model using past 30 days of data.
        Runs weekly to adapt to changing patterns.
        
        Requirements: 1.6
        """
        try:
            logger.info("Starting scheduled anomaly model training job")
            
            # Train model on past 30 days of data
            metrics = await self.anomaly_service.train_model(days_of_history=30)
            
            logger.info(f"Anomaly model training completed: {metrics}")
            
            # Store model metadata in database
            await self._store_model_metadata(
                model_type='anomaly_detector',
                model_version=metrics.model_version,
                training_data_size=metrics.training_data_size,
                metrics={
                    'contamination': metrics.contamination,
                    'n_estimators': metrics.n_estimators,
                    'anomaly_threshold': metrics.anomaly_threshold
                }
            )
            
            logger.info("Anomaly model training job completed successfully")
            
        except Exception as e:
            logger.error(f"Anomaly model training job failed: {str(e)}")
            raise
    
    async def run_classifier_training(self):
        """
        Scheduled job for ML classifier training.
        
        Retrains category and risk classifiers using past 30 days of labeled data.
        Runs monthly to improve classification accuracy.
        
        Requirements: 4.11
        """
        try:
            logger.info("Starting scheduled classifier training job")
            
            # Fetch labeled training data from past 30 days
            start_date = datetime.now() - timedelta(days=30)
            
            response = self.supabase.table("audit_logs").select("*").gte(
                "timestamp", start_date.isoformat()
            ).not_.is_("category", "null").not_.is_("risk_level", "null").execute()
            
            labeled_data = response.data if response.data else []
            
            if len(labeled_data) < 100:
                logger.warning(f"Insufficient labeled data ({len(labeled_data)} events), skipping training")
                return
            
            logger.info(f"Training classifiers on {len(labeled_data)} labeled events")
            
            # Train classifiers
            metrics = await self.ml_service.train_classifiers(labeled_data)
            
            logger.info(f"Classifier training completed: {metrics}")
            
            # Store model metadata
            await self._store_model_metadata(
                model_type='category_classifier',
                model_version=metrics.get('version', '1.0.0'),
                training_data_size=len(labeled_data),
                metrics={
                    'category_accuracy': metrics.get('category_accuracy'),
                    'risk_accuracy': metrics.get('risk_accuracy')
                }
            )
            
            logger.info("Classifier training job completed successfully")
            
        except Exception as e:
            logger.error(f"Classifier training job failed: {str(e)}")
            raise
    
    async def _store_model_metadata(
        self,
        model_type: str,
        model_version: str,
        training_data_size: int,
        metrics: Dict[str, Any]
    ):
        """
        Store model training metadata in database.
        
        Args:
            model_type: Type of model (anomaly_detector, category_classifier, etc.)
            model_version: Version string
            training_data_size: Number of training samples
            metrics: Training metrics dictionary
        """
        try:
            # Deactivate previous models of this type
            self.supabase.table("audit_ml_models").update({
                "is_active": False
            }).eq("model_type", model_type).execute()
            
            # Insert new model metadata
            self.supabase.table("audit_ml_models").insert({
                "model_type": model_type,
                "model_version": model_version,
                "training_date": datetime.now().isoformat(),
                "training_data_size": training_data_size,
                "metrics": metrics,
                "model_path": f"/models/{model_type}_{model_version}.pkl",
                "is_active": True,
                "tenant_id": None  # Shared model
            }).execute()
            
            logger.info(f"Stored metadata for {model_type} v{model_version}")
            
        except Exception as e:
            logger.error(f"Failed to store model metadata: {str(e)}")
    
    async def run_scheduled_reports(self):
        """
        Scheduled job to check and generate scheduled reports.
        
        Checks for reports that are due to run, generates them,
        and sends via email using configured SMTP.
        
        Requirements: 5.9, 5.10
        """
        try:
            logger.info("Starting scheduled reports check job")
            
            # Fetch reports that are due to run
            now = datetime.now()
            
            response = self.supabase.table("audit_scheduled_reports").select("*").eq(
                "is_active", True
            ).lte("next_run", now.isoformat()).execute()
            
            reports = response.data if response.data else []
            
            if not reports:
                logger.info("No scheduled reports due to run")
                return
            
            logger.info(f"Processing {len(reports)} scheduled reports")
            
            # Process each report
            for report in reports:
                try:
                    await self._generate_and_send_report(report)
                except Exception as e:
                    logger.error(f"Failed to process report {report['id']}: {str(e)}")
                    continue
            
            logger.info("Scheduled reports job completed")
            
        except Exception as e:
            logger.error(f"Scheduled reports job failed: {str(e)}")
            raise
    
    async def _generate_and_send_report(self, report: Dict[str, Any]):
        """
        Generate and send a scheduled report.
        
        Args:
            report: Report configuration from database
        """
        try:
            report_id = report['id']
            report_name = report['report_name']
            filters = report['filters']
            recipients = report['recipients']
            include_summary = report['include_summary']
            format_type = report['format']
            
            logger.info(f"Generating report: {report_name}")
            
            # Generate report based on format
            if format_type == 'pdf':
                report_data = await self.export_service.export_pdf(
                    filters=filters,
                    include_summary=include_summary
                )
            elif format_type == 'csv':
                report_data = await self.export_service.export_csv(filters=filters)
            else:
                logger.error(f"Unknown report format: {format_type}")
                return
            
            # Send report via email
            await self._send_report_email(
                report_name=report_name,
                report_data=report_data,
                recipients=recipients,
                format_type=format_type
            )
            
            # Update next_run timestamp
            await self._update_next_run(report_id, report['schedule_cron'])
            
            # Update last_run timestamp
            self.supabase.table("audit_scheduled_reports").update({
                "last_run": datetime.now().isoformat()
            }).eq("id", report_id).execute()
            
            logger.info(f"Successfully generated and sent report: {report_name}")
            
        except Exception as e:
            logger.error(f"Failed to generate/send report: {str(e)}")
            raise
    
    async def _send_report_email(
        self,
        report_name: str,
        report_data: bytes,
        recipients: List[str],
        format_type: str
    ):
        """
        Send report via email using configured SMTP.
        
        Args:
            report_name: Name of the report
            report_data: Report file data
            recipients: List of recipient email addresses
            format_type: Report format (pdf or csv)
        """
        # TODO: Implement email sending using SMTP
        # This would require SMTP configuration and email library
        logger.info(f"Email sending not yet implemented. Would send {report_name}.{format_type} to {recipients}")
    
    async def _update_next_run(self, report_id: str, cron_expression: str):
        """
        Calculate and update next_run timestamp based on cron expression.
        
        Args:
            report_id: Report ID
            cron_expression: Cron expression for schedule
        """
        try:
            from croniter import croniter
            
            # Calculate next run time
            now = datetime.now()
            cron = croniter(cron_expression, now)
            next_run = cron.get_next(datetime)
            
            # Update database
            self.supabase.table("audit_scheduled_reports").update({
                "next_run": next_run.isoformat()
            }).eq("id", report_id).execute()
            
            logger.info(f"Updated next_run for report {report_id} to {next_run}")
            
        except Exception as e:
            logger.error(f"Failed to update next_run: {str(e)}")


# Global instance
_scheduled_jobs_instance: Optional[AuditScheduledJobs] = None


def get_scheduled_jobs(
    supabase_client=None,
    redis_client=None,
    openai_api_key: Optional[str] = None
) -> AuditScheduledJobs:
    """
    Get the global scheduled jobs instance.
    
    Args:
        supabase_client: Supabase client
        redis_client: Redis client
        openai_api_key: OpenAI API key
        
    Returns:
        AuditScheduledJobs instance
    """
    global _scheduled_jobs_instance
    if _scheduled_jobs_instance is None:
        _scheduled_jobs_instance = AuditScheduledJobs(
            supabase_client=supabase_client,
            redis_client=redis_client,
            openai_api_key=openai_api_key
        )
    return _scheduled_jobs_instance
