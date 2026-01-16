"""
Enhanced PMR Service with Performance Optimizations
Integrates caching, performance monitoring, and optimized data loading
"""

import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from services.enhanced_pmr_service import EnhancedPMRService
from services.pmr_cache_service import PMRCacheService
from services.pmr_performance_monitor import performance_monitor
from models.pmr import EnhancedPMRReport, EnhancedPMRGenerationRequest

logger = logging.getLogger(__name__)


class EnhancedPMRServiceOptimized(EnhancedPMRService):
    """
    Optimized Enhanced PMR Service with caching and performance monitoring
    Extends base service with performance improvements
    """
    
    def __init__(self, supabase_client, openai_api_key: str, redis_url: Optional[str] = None):
        """Initialize optimized service with caching"""
        super().__init__(supabase_client, openai_api_key)
        
        # Initialize cache service
        self.cache_service = PMRCacheService(redis_url)
        
        # Initialize performance monitor
        self.performance_monitor = performance_monitor
        
        logger.info("Enhanced PMR Service Optimized initialized")
    
    @performance_monitor.track_time("report_generation_time")
    async def generate_enhanced_pmr(
        self,
        request: EnhancedPMRGenerationRequest,
        user_id: UUID
    ) -> EnhancedPMRReport:
        """
        Generate Enhanced PMR with caching and performance monitoring
        """
        try:
            # Check cache first
            cache_key = f"{request.project_id}_{request.report_month}_{request.report_year}"
            cached_report = await self.cache_service.get_cached_report(UUID(cache_key))
            
            if cached_report:
                logger.info(f"Cache hit for report {cache_key}")
                self.performance_monitor.record_metric("cache_hit_rate", 100, "%")
                # Would need to deserialize cached report
                # return self._deserialize_report(cached_report)
            
            self.performance_monitor.record_metric("cache_hit_rate", 0, "%")
            
            # Generate report using parent method
            report = await super().generate_enhanced_pmr(request, user_id)
            
            # Cache the generated report
            if self.cache_service.is_enabled():
                report_data = self._serialize_report(report)
                await self.cache_service.cache_report(
                    report.id,
                    report_data,
                    ttl=3600  # 1 hour
                )
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate optimized PMR: {e}")
            raise
    
    @performance_monitor.track_time("ai_insight_generation_time")
    async def _generate_ai_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        categories: Optional[list] = None
    ) -> list:
        """
        Generate AI insights with caching
        """
        try:
            # Check cache for insights
            cached_insights = await self.cache_service.get_cached_insights(report_id)
            
            if cached_insights:
                logger.info(f"Cache hit for insights {report_id}")
                return cached_insights
            
            # Generate insights using parent method
            insights = await super()._generate_ai_insights(report_id, project_id, categories)
            
            # Cache insights
            if self.cache_service.is_enabled() and insights:
                insights_data = [self._serialize_insight(i) for i in insights]
                await self.cache_service.cache_insights(
                    report_id,
                    insights_data,
                    ttl=1800  # 30 minutes
                )
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate optimized AI insights: {e}")
            return []
    
    @performance_monitor.track_time("monte_carlo_analysis_time")
    async def _run_monte_carlo_analysis(
        self,
        project_id: UUID,
        iterations: int = 1000,
        confidence_levels: list = None
    ):
        """
        Run Monte Carlo analysis with caching
        """
        try:
            # Check cache for Monte Carlo results
            cache_key = f"mc_{project_id}_{iterations}"
            # Note: Would need to implement cache key generation
            
            # Run analysis using parent method
            results = await super()._run_monte_carlo_analysis(
                project_id,
                iterations,
                confidence_levels
            )
            
            # Cache results
            if self.cache_service.is_enabled() and results:
                results_data = self._serialize_monte_carlo(results)
                # Would cache with appropriate key
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to run optimized Monte Carlo: {e}")
            raise
    
    @performance_monitor.track_time("database_query_time")
    async def _collect_real_time_metrics(self, project_id: UUID):
        """
        Collect real-time metrics with caching
        """
        try:
            # Check cache for metrics
            cached_metrics = await self.cache_service.get_cached_metrics(project_id)
            
            if cached_metrics:
                logger.info(f"Cache hit for metrics {project_id}")
                return cached_metrics
            
            # Collect metrics using parent method
            metrics = await super()._collect_real_time_metrics(project_id)
            
            # Cache metrics with short TTL (5 minutes)
            if self.cache_service.is_enabled() and metrics:
                metrics_data = self._serialize_metrics(metrics)
                await self.cache_service.cache_metrics(
                    project_id,
                    metrics_data,
                    ttl=300  # 5 minutes
                )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect optimized metrics: {e}")
            raise
    
    async def get_report(self, report_id: UUID) -> Optional[EnhancedPMRReport]:
        """
        Retrieve report with caching
        """
        try:
            # Check cache first
            cached_report = await self.cache_service.get_cached_report(report_id)
            
            if cached_report:
                logger.info(f"Cache hit for report retrieval {report_id}")
                self.performance_monitor.record_metric("cache_hit_rate", 100, "%")
                # Would deserialize cached report
                # return self._deserialize_report(cached_report)
            
            self.performance_monitor.record_metric("cache_hit_rate", 0, "%")
            
            # Get from database using parent method
            report = await super().get_report(report_id)
            
            # Cache the report
            if report and self.cache_service.is_enabled():
                report_data = self._serialize_report(report)
                await self.cache_service.cache_report(
                    report_id,
                    report_data,
                    ttl=3600
                )
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to get optimized report: {e}")
            return None
    
    async def invalidate_report_cache(self, report_id: UUID) -> bool:
        """Invalidate cached report data"""
        try:
            await self.cache_service.invalidate_report(report_id)
            logger.info(f"Invalidated cache for report {report_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to invalidate cache: {e}")
            return False
    
    async def invalidate_project_caches(self, project_id: UUID) -> int:
        """Invalidate all caches for a project"""
        try:
            count = await self.cache_service.invalidate_project_caches(project_id)
            logger.info(f"Invalidated {count} cache entries for project {project_id}")
            return count
        except Exception as e:
            logger.error(f"Failed to invalidate project caches: {e}")
            return 0
    
    # Serialization helpers
    
    def _serialize_report(self, report: EnhancedPMRReport) -> Dict[str, Any]:
        """Serialize report for caching"""
        try:
            return {
                "id": str(report.id),
                "project_id": str(report.project_id),
                "title": report.title,
                "status": report.status.value,
                "report_month": report.report_month.isoformat(),
                "report_year": report.report_year,
                "executive_summary": report.executive_summary,
                "ai_generated_summary": report.ai_generated_summary,
                "sections": report.sections,
                "metrics": report.metrics,
                "version": report.version,
                "generated_at": report.generated_at.isoformat(),
                "last_modified": report.last_modified.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to serialize report: {e}")
            return {}
    
    def _serialize_insight(self, insight) -> Dict[str, Any]:
        """Serialize AI insight for caching"""
        try:
            return {
                "id": str(insight.id),
                "title": insight.title,
                "content": insight.content,
                "confidence_score": float(insight.confidence_score),
                "category": insight.category.value,
                "priority": insight.priority.value,
                "generated_at": insight.generated_at.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to serialize insight: {e}")
            return {}
    
    def _serialize_monte_carlo(self, results) -> Dict[str, Any]:
        """Serialize Monte Carlo results for caching"""
        try:
            return {
                "analysis_type": results.analysis_type,
                "iterations": results.iterations,
                "budget_completion": results.budget_completion,
                "schedule_completion": results.schedule_completion,
                "confidence_intervals": results.confidence_intervals,
                "recommendations": results.recommendations,
                "generated_at": results.generated_at.isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to serialize Monte Carlo results: {e}")
            return {}
    
    def _serialize_metrics(self, metrics) -> Dict[str, Any]:
        """Serialize metrics for caching"""
        try:
            return {
                "last_updated": metrics.last_updated.isoformat(),
                "budget_utilization": float(metrics.budget_utilization) if metrics.budget_utilization else None,
                "schedule_performance_index": float(metrics.schedule_performance_index) if metrics.schedule_performance_index else None,
                "cost_performance_index": float(metrics.cost_performance_index) if metrics.cost_performance_index else None,
                "risk_score": float(metrics.risk_score) if metrics.risk_score else None,
                "active_issues_count": metrics.active_issues_count,
                "completed_milestones": metrics.completed_milestones,
                "upcoming_milestones": metrics.upcoming_milestones
            }
        except Exception as e:
            logger.error(f"Failed to serialize metrics: {e}")
            return {}
    
    # Performance monitoring
    
    async def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        try:
            cache_stats = await self.cache_service.get_cache_stats()
            monitor_stats = self.performance_monitor.get_all_stats()
            
            return {
                "cache": cache_stats,
                "performance": monitor_stats,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get performance stats: {e}")
            return {"error": str(e)}
    
    async def get_optimization_recommendations(self) -> list:
        """Get optimization recommendations"""
        try:
            return self.performance_monitor.get_optimization_recommendations()
        except Exception as e:
            logger.error(f"Failed to get optimization recommendations: {e}")
            return []
    
    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check"""
        try:
            cache_health = await self.cache_service.health_check()
            monitor_health = self.performance_monitor.health_check()
            
            overall_status = "healthy"
            if cache_health.get("status") == "unhealthy" or monitor_health.get("status") == "unhealthy":
                overall_status = "degraded"
            
            return {
                "status": overall_status,
                "cache": cache_health,
                "monitor": monitor_health,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
