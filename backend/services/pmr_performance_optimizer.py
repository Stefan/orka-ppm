"""
PMR Performance Optimizer
Implements lazy loading, caching strategies, and performance monitoring for Enhanced PMR
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from uuid import UUID
from decimal import Decimal

from performance_optimization import CacheManager, PerformanceMonitor, create_cache_key

logger = logging.getLogger(__name__)


class PMRPerformanceOptimizer:
    """
    Performance optimization service for Enhanced PMR
    Handles caching, lazy loading, and performance monitoring
    """
    
    def __init__(self, cache_manager: CacheManager, performance_monitor: PerformanceMonitor):
        """Initialize PMR Performance Optimizer"""
        self.cache = cache_manager
        self.monitor = performance_monitor
        
        # Cache TTL configurations (in seconds)
        self.CACHE_TTL = {
            'report_metadata': 300,      # 5 minutes
            'report_full': 120,          # 2 minutes
            'ai_insights': 180,          # 3 minutes
            'monte_carlo': 600,          # 10 minutes
            'sections': 120,             # 2 minutes
            'templates': 1800,           # 30 minutes
            'collaboration': 30,         # 30 seconds (real-time)
            'export_jobs': 60            # 1 minute
        }
        
        logger.info("PMR Performance Optimizer initialized")
    
    # ========================================================================
    # Report Caching
    # ========================================================================
    
    async def cache_report_metadata(
        self,
        report_id: UUID,
        metadata: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache report metadata (lightweight data)"""
        try:
            cache_key = create_cache_key('pmr', 'metadata', str(report_id))
            ttl = ttl or self.CACHE_TTL['report_metadata']
            
            return await self.cache.set(cache_key, metadata, ttl)
        except Exception as e:
            logger.error(f"Failed to cache report metadata: {e}")
            return False
    
    async def get_cached_report_metadata(
        self,
        report_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get cached report metadata"""
        try:
            cache_key = create_cache_key('pmr', 'metadata', str(report_id))
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached report metadata: {e}")
            return None
    
    async def cache_full_report(
        self,
        report_id: UUID,
        report_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache full report data"""
        try:
            cache_key = create_cache_key('pmr', 'full', str(report_id))
            ttl = ttl or self.CACHE_TTL['report_full']
            
            return await self.cache.set(cache_key, report_data, ttl)
        except Exception as e:
            logger.error(f"Failed to cache full report: {e}")
            return False
    
    async def get_cached_full_report(
        self,
        report_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get cached full report"""
        try:
            cache_key = create_cache_key('pmr', 'full', str(report_id))
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached full report: {e}")
            return None
    
    async def invalidate_report_cache(self, report_id: UUID) -> int:
        """Invalidate all cache entries for a report"""
        try:
            pattern = f"pmr:*:{str(report_id)}*"
            count = await self.cache.clear_pattern(pattern)
            logger.info(f"Invalidated {count} cache entries for report {report_id}")
            return count
        except Exception as e:
            logger.error(f"Failed to invalidate report cache: {e}")
            return 0
    
    # ========================================================================
    # Lazy Loading Support
    # ========================================================================
    
    async def cache_section(
        self,
        report_id: UUID,
        section_id: str,
        section_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache individual section for lazy loading"""
        try:
            cache_key = create_cache_key('pmr', 'section', str(report_id), section_id)
            ttl = ttl or self.CACHE_TTL['sections']
            
            return await self.cache.set(cache_key, section_data, ttl)
        except Exception as e:
            logger.error(f"Failed to cache section: {e}")
            return False
    
    async def get_cached_section(
        self,
        report_id: UUID,
        section_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached section"""
        try:
            cache_key = create_cache_key('pmr', 'section', str(report_id), section_id)
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached section: {e}")
            return None
    
    async def cache_ai_insights(
        self,
        report_id: UUID,
        insights: List[Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache AI insights for lazy loading"""
        try:
            cache_key = create_cache_key('pmr', 'insights', str(report_id))
            ttl = ttl or self.CACHE_TTL['ai_insights']
            
            return await self.cache.set(cache_key, insights, ttl)
        except Exception as e:
            logger.error(f"Failed to cache AI insights: {e}")
            return False
    
    async def get_cached_ai_insights(
        self,
        report_id: UUID,
        category: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached AI insights, optionally filtered by category"""
        try:
            cache_key = create_cache_key('pmr', 'insights', str(report_id))
            insights = await self.cache.get(cache_key)
            
            if insights and category:
                # Filter by category
                insights = [i for i in insights if i.get('category') == category]
            
            return insights
        except Exception as e:
            logger.error(f"Failed to get cached AI insights: {e}")
            return None
    
    async def cache_monte_carlo_results(
        self,
        report_id: UUID,
        results: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache Monte Carlo analysis results"""
        try:
            cache_key = create_cache_key('pmr', 'monte_carlo', str(report_id))
            ttl = ttl or self.CACHE_TTL['monte_carlo']
            
            return await self.cache.set(cache_key, results, ttl)
        except Exception as e:
            logger.error(f"Failed to cache Monte Carlo results: {e}")
            return False
    
    async def get_cached_monte_carlo_results(
        self,
        report_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get cached Monte Carlo results"""
        try:
            cache_key = create_cache_key('pmr', 'monte_carlo', str(report_id))
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached Monte Carlo results: {e}")
            return None
    
    # ========================================================================
    # Template Caching
    # ========================================================================
    
    async def cache_template(
        self,
        template_id: UUID,
        template_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache PMR template"""
        try:
            cache_key = create_cache_key('pmr', 'template', str(template_id))
            ttl = ttl or self.CACHE_TTL['templates']
            
            return await self.cache.set(cache_key, template_data, ttl)
        except Exception as e:
            logger.error(f"Failed to cache template: {e}")
            return False
    
    async def get_cached_template(
        self,
        template_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get cached template"""
        try:
            cache_key = create_cache_key('pmr', 'template', str(template_id))
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached template: {e}")
            return None
    
    async def cache_template_list(
        self,
        filters: Dict[str, Any],
        templates: List[Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache template list with filters"""
        try:
            cache_key = create_cache_key('pmr', 'templates', 'list', **filters)
            ttl = ttl or self.CACHE_TTL['templates']
            
            return await self.cache.set(cache_key, templates, ttl)
        except Exception as e:
            logger.error(f"Failed to cache template list: {e}")
            return False
    
    async def get_cached_template_list(
        self,
        filters: Dict[str, Any]
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached template list"""
        try:
            cache_key = create_cache_key('pmr', 'templates', 'list', **filters)
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached template list: {e}")
            return None
    
    # ========================================================================
    # Collaboration Session Caching
    # ========================================================================
    
    async def cache_collaboration_session(
        self,
        session_id: str,
        session_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache collaboration session (short TTL for real-time data)"""
        try:
            cache_key = create_cache_key('pmr', 'collab', session_id)
            ttl = ttl or self.CACHE_TTL['collaboration']
            
            return await self.cache.set(cache_key, session_data, ttl)
        except Exception as e:
            logger.error(f"Failed to cache collaboration session: {e}")
            return False
    
    async def get_cached_collaboration_session(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached collaboration session"""
        try:
            cache_key = create_cache_key('pmr', 'collab', session_id)
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached collaboration session: {e}")
            return None
    
    async def invalidate_collaboration_session(self, session_id: str) -> bool:
        """Invalidate collaboration session cache"""
        try:
            cache_key = create_cache_key('pmr', 'collab', session_id)
            return await self.cache.delete(cache_key)
        except Exception as e:
            logger.error(f"Failed to invalidate collaboration session: {e}")
            return False
    
    # ========================================================================
    # Export Job Caching
    # ========================================================================
    
    async def cache_export_job(
        self,
        job_id: str,
        job_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache export job status"""
        try:
            cache_key = create_cache_key('pmr', 'export', job_id)
            ttl = ttl or self.CACHE_TTL['export_jobs']
            
            return await self.cache.set(cache_key, job_data, ttl)
        except Exception as e:
            logger.error(f"Failed to cache export job: {e}")
            return False
    
    async def get_cached_export_job(
        self,
        job_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached export job"""
        try:
            cache_key = create_cache_key('pmr', 'export', job_id)
            return await self.cache.get(cache_key)
        except Exception as e:
            logger.error(f"Failed to get cached export job: {e}")
            return None
    
    # ========================================================================
    # Performance Monitoring
    # ========================================================================
    
    def record_report_generation(
        self,
        report_id: UUID,
        duration_seconds: float,
        sections_count: int,
        insights_count: int,
        has_monte_carlo: bool
    ):
        """Record report generation performance metrics"""
        try:
            self.monitor.record_request(
                method='GENERATE',
                endpoint=f'/pmr/{report_id}',
                status_code=200,
                duration=duration_seconds
            )
            
            logger.info(
                f"Report generation metrics - "
                f"ID: {report_id}, "
                f"Duration: {duration_seconds:.2f}s, "
                f"Sections: {sections_count}, "
                f"Insights: {insights_count}, "
                f"Monte Carlo: {has_monte_carlo}"
            )
        except Exception as e:
            logger.error(f"Failed to record report generation metrics: {e}")
    
    def record_section_load(
        self,
        report_id: UUID,
        section_id: str,
        duration_seconds: float,
        from_cache: bool
    ):
        """Record section lazy load performance"""
        try:
            self.monitor.record_request(
                method='LOAD_SECTION',
                endpoint=f'/pmr/{report_id}/section/{section_id}',
                status_code=200,
                duration=duration_seconds
            )
            
            logger.debug(
                f"Section load - "
                f"Report: {report_id}, "
                f"Section: {section_id}, "
                f"Duration: {duration_seconds:.3f}s, "
                f"Cached: {from_cache}"
            )
        except Exception as e:
            logger.error(f"Failed to record section load metrics: {e}")
    
    def record_insights_load(
        self,
        report_id: UUID,
        insights_count: int,
        duration_seconds: float,
        from_cache: bool
    ):
        """Record AI insights lazy load performance"""
        try:
            self.monitor.record_request(
                method='LOAD_INSIGHTS',
                endpoint=f'/pmr/{report_id}/insights',
                status_code=200,
                duration=duration_seconds
            )
            
            logger.debug(
                f"Insights load - "
                f"Report: {report_id}, "
                f"Count: {insights_count}, "
                f"Duration: {duration_seconds:.3f}s, "
                f"Cached: {from_cache}"
            )
        except Exception as e:
            logger.error(f"Failed to record insights load metrics: {e}")
    
    async def get_pmr_performance_stats(self) -> Dict[str, Any]:
        """Get PMR-specific performance statistics"""
        try:
            overall_stats = self.monitor.get_performance_summary()
            
            # Filter for PMR-specific endpoints
            pmr_stats = {
                'report_generation': {},
                'section_loads': {},
                'insights_loads': {},
                'cache_efficiency': {}
            }
            
            for endpoint_key, stats in overall_stats.get('endpoint_stats', {}).items():
                if '/pmr/' in endpoint_key:
                    if 'GENERATE' in endpoint_key:
                        pmr_stats['report_generation'] = stats
                    elif 'LOAD_SECTION' in endpoint_key:
                        pmr_stats['section_loads'] = stats
                    elif 'LOAD_INSIGHTS' in endpoint_key:
                        pmr_stats['insights_loads'] = stats
            
            return {
                'overall': overall_stats,
                'pmr_specific': pmr_stats,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Failed to get PMR performance stats: {e}")
            return {'error': str(e)}
    
    # ========================================================================
    # Batch Operations
    # ========================================================================
    
    async def batch_cache_sections(
        self,
        report_id: UUID,
        sections: List[Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> int:
        """Batch cache multiple sections"""
        try:
            cached_count = 0
            tasks = []
            
            for section in sections:
                section_id = section.get('section_id')
                if section_id:
                    task = self.cache_section(report_id, section_id, section, ttl)
                    tasks.append(task)
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            cached_count = sum(1 for r in results if r is True)
            
            logger.info(f"Batch cached {cached_count}/{len(sections)} sections for report {report_id}")
            return cached_count
        except Exception as e:
            logger.error(f"Failed to batch cache sections: {e}")
            return 0
    
    async def preload_report_data(
        self,
        report_id: UUID,
        include_sections: bool = True,
        include_insights: bool = True,
        include_monte_carlo: bool = True
    ) -> Dict[str, bool]:
        """Preload and cache report data for faster access"""
        try:
            results = {
                'metadata': False,
                'sections': False,
                'insights': False,
                'monte_carlo': False
            }
            
            # This would be called after report generation to warm the cache
            logger.info(f"Preloading report data for {report_id}")
            
            return results
        except Exception as e:
            logger.error(f"Failed to preload report data: {e}")
            return {'error': str(e)}


# Export
__all__ = ['PMRPerformanceOptimizer']
