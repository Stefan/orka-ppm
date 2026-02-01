#!/usr/bin/env python3
"""
Monitoring and Alerting Setup for RAG Knowledge Base
Sets up logging, metrics collection, and alerting for the RAG system
"""

import os
import sys
import json
import logging
import time
from typing import Dict, Any, List
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('rag_monitoring.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class RAGMonitor:
    """Monitoring system for RAG operations"""

    def __init__(self, log_directory: str = "logs"):
        self.log_directory = Path(log_directory)
        self.log_directory.mkdir(exist_ok=True)

        # Alert thresholds
        self.alert_thresholds = {
            "error_rate": 0.05,  # 5% error rate
            "response_time": 5000,  # 5 seconds
            "cache_hit_rate": 0.3,  # 30% minimum
        }

        # Metrics storage
        self.metrics_history = []

    def setup_structured_logging(self):
        """Set up structured logging for all RAG operations"""

        # Create formatters
        structured_formatter = logging.Formatter(
            json.dumps({
                "timestamp": "%(asctime)s",
                "level": "%(levelname)s",
                "service": "rag-knowledge-base",
                "component": "%(name)s",
                "message": "%(message)s",
                "extra": "%(extra)s"
            }, default=str)
        )

        # File handler for structured logs
        log_file = self.log_directory / "rag_operations.jsonl"
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(structured_formatter)
        file_handler.setLevel(logging.INFO)

        # Add to root logger
        root_logger = logging.getLogger()
        root_logger.addHandler(file_handler)

        # Create component-specific loggers
        components = [
            "services.embedding_service",
            "services.vector_store",
            "services.context_retriever",
            "services.response_generator",
            "services.rag_orchestrator",
            "services.response_cache",
            "routers.help_chat",
            "routers.admin.knowledge"
        ]

        for component in components:
            component_logger = logging.getLogger(component)
            component_logger.setLevel(logging.INFO)

        logger.info("Structured logging setup completed", extra={
            "log_file": str(log_file),
            "components": components
        })

    def create_grafana_dashboard_config(self) -> Dict[str, Any]:
        """Create Grafana dashboard configuration for RAG metrics"""

        dashboard = {
            "dashboard": {
                "title": "RAG Knowledge Base Monitoring",
                "tags": ["rag", "knowledge-base", "ai"],
                "timezone": "UTC",
                "panels": [
                    {
                        "title": "Query Volume",
                        "type": "graph",
                        "targets": [{
                            "expr": "rate(rag_queries_total[5m])",
                            "legendFormat": "Queries per second"
                        }]
                    },
                    {
                        "title": "Response Time",
                        "type": "graph",
                        "targets": [{
                            "expr": "histogram_quantile(0.95, rate(rag_response_time_bucket[5m]))",
                            "legendFormat": "95th percentile"
                        }]
                    },
                    {
                        "title": "Error Rate",
                        "type": "graph",
                        "targets": [{
                            "expr": "rate(rag_errors_total[5m]) / rate(rag_queries_total[5m])",
                            "legendFormat": "Error rate"
                        }]
                    },
                    {
                        "title": "Cache Hit Rate",
                        "type": "graph",
                        "targets": [{
                            "expr": "rate(rag_cache_hits_total[5m]) / rate(rag_cache_requests_total[5m])",
                            "legendFormat": "Cache hit rate"
                        }]
                    }
                ]
            }
        }

        return dashboard

    def setup_alerts(self) -> List[Dict[str, Any]]:
        """Set up alerting rules for critical metrics"""

        alerts = [
            {
                "name": "High Error Rate",
                "query": "rate(rag_errors_total[5m]) / rate(rag_queries_total[5m]) > 0.05",
                "for": "5m",
                "labels": {"severity": "critical"},
                "annotations": {
                    "summary": "RAG system error rate is too high",
                    "description": "Error rate is above 5% for the last 5 minutes"
                }
            },
            {
                "name": "Slow Response Time",
                "query": "histogram_quantile(0.95, rate(rag_response_time_bucket[5m])) > 5000",
                "for": "5m",
                "labels": {"severity": "warning"},
                "annotations": {
                    "summary": "RAG response time is too slow",
                    "description": "95th percentile response time is above 5 seconds"
                }
            },
            {
                "name": "Low Cache Hit Rate",
                "query": "rate(rag_cache_hits_total[5m]) / rate(rag_cache_requests_total[5m]) < 0.3",
                "for": "10m",
                "labels": {"severity": "info"},
                "annotations": {
                    "summary": "RAG cache hit rate is low",
                    "description": "Cache hit rate is below 30% for the last 10 minutes"
                }
            },
            {
                "name": "Embedding Service Failure",
                "query": "up{job='rag-embedding-service'} == 0",
                "for": "1m",
                "labels": {"severity": "critical"},
                "annotations": {
                    "summary": "Embedding service is down",
                    "description": "Embedding service has been down for 1 minute"
                }
            },
            {
                "name": "Vector Store Unavailable",
                "query": "up{job='rag-vector-store'} == 0",
                "for": "1m",
                "labels": {"severity": "critical"},
                "annotations": {
                    "summary": "Vector store is unavailable",
                    "description": "Vector store has been unavailable for 1 minute"
                }
            }
        ]

        return alerts

    def create_daily_report(self) -> Dict[str, Any]:
        """Generate daily usage and performance report"""

        # In a real implementation, this would query actual metrics
        # For now, return a template structure

        report = {
            "date": datetime.now().date().isoformat(),
            "summary": {
                "total_queries": 0,
                "successful_queries": 0,
                "failed_queries": 0,
                "average_response_time_ms": 0.0,
                "cache_hit_rate": 0.0,
                "error_rate": 0.0
            },
            "top_queries": [],
            "failed_ingestions": [],
            "performance_trends": {
                "response_time_trend": "stable",
                "error_rate_trend": "stable",
                "cache_performance_trend": "stable"
            },
            "recommendations": []
        }

        return report

    def check_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Check current metrics against alert thresholds

        Args:
            metrics: Current system metrics

        Returns:
            List of active alerts
        """
        active_alerts = []

        # Check error rate
        error_rate = metrics.get("error_rate", 0)
        if error_rate > self.alert_thresholds["error_rate"]:
            active_alerts.append({
                "alert": "High Error Rate",
                "value": error_rate,
                "threshold": self.alert_thresholds["error_rate"],
                "severity": "critical"
            })

        # Check response time
        avg_response_time = metrics.get("average_response_time_ms", 0)
        if avg_response_time > self.alert_thresholds["response_time"]:
            active_alerts.append({
                "alert": "Slow Response Time",
                "value": avg_response_time,
                "threshold": self.alert_thresholds["response_time"],
                "severity": "warning"
            })

        # Check cache hit rate
        cache_hit_rate = metrics.get("cache_hit_rate", 1.0)
        if cache_hit_rate < self.alert_thresholds["cache_hit_rate"]:
            active_alerts.append({
                "alert": "Low Cache Hit Rate",
                "value": cache_hit_rate,
                "threshold": self.alert_thresholds["cache_hit_rate"],
                "severity": "info"
            })

        return active_alerts

    def export_monitoring_config(self):
        """Export monitoring configuration files"""

        # Create logs directory
        self.log_directory.mkdir(exist_ok=True)

        # Export Grafana dashboard
        dashboard_file = self.log_directory / "grafana_dashboard.json"
        with open(dashboard_file, 'w') as f:
            json.dump(self.create_grafana_dashboard_config(), f, indent=2)

        # Export alert rules
        alerts_file = self.log_directory / "alert_rules.json"
        with open(alerts_file, 'w') as f:
            json.dump({"groups": [{"name": "rag_alerts", "rules": self.setup_alerts()}]}, f, indent=2)

        # Export Prometheus metrics configuration
        prometheus_config = {
            "scrape_configs": [
                {
                    "job_name": "rag-knowledge-base",
                    "static_configs": [{"targets": ["localhost:8000"]}],
                    "metrics_path": "/metrics"
                }
            ]
        }

        prometheus_file = self.log_directory / "prometheus_config.yml"
        with open(prometheus_file, 'w') as f:
            import yaml
            yaml.dump(prometheus_config, f)

        logger.info("Monitoring configuration exported", extra={
            "dashboard_file": str(dashboard_file),
            "alerts_file": str(alerts_file),
            "prometheus_file": str(prometheus_file)
        })

        return {
            "dashboard": str(dashboard_file),
            "alerts": str(alerts_file),
            "prometheus": str(prometheus_file)
        }


def main():
    """Main monitoring setup function"""
    print("📊 RAG Monitoring Setup")
    print("=" * 40)

    monitor = RAGMonitor()

    try:
        # Setup structured logging
        print("\n📝 Setting up structured logging...")
        monitor.setup_structured_logging()

        # Export monitoring configuration
        print("\n📤 Exporting monitoring configuration...")
        config_files = monitor.export_monitoring_config()

        print("\n📋 Monitoring Configuration Files:")
        for name, path in config_files.items():
            print(f"  {name}: {path}")

        # Generate sample daily report
        print("\n📊 Generating sample daily report...")
        report = monitor.create_daily_report()

        report_file = monitor.log_directory / "sample_daily_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"  Sample report: {report_file}")

        # Test alert checking
        print("\n🚨 Testing alert system...")
        sample_metrics = {
            "error_rate": 0.02,
            "average_response_time_ms": 1200,
            "cache_hit_rate": 0.75
        }

        alerts = monitor.check_alerts(sample_metrics)
        if alerts:
            print("  Active alerts:")
            for alert in alerts:
                print(f"    {alert['alert']}: {alert['value']} (threshold: {alert['threshold']})")
        else:
            print("  No active alerts ✅")

        print("\n✅ Monitoring setup completed successfully!")
        print("\nNext steps:")
        print("1. Import the Grafana dashboard from grafana_dashboard.json")
        print("2. Configure Prometheus with prometheus_config.yml")
        print("3. Set up alert notifications for the alert rules")
        print("4. Schedule daily reports using the sample_daily_report.json as a template")

    except Exception as e:
        print(f"❌ Monitoring setup failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()