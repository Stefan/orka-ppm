"""
Simulation Cache Service for Monte Carlo Results.

This service provides Redis-based caching for Monte Carlo simulation results
with automatic cache invalidation and background processing support.
"""

import logging
import json
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from uuid import UUID
import redis.asyncio as aioredis
import os
import pickle
import numpy as np

from monte_carlo.models import SimulationResults

logger = logging.getLogger(__name__)


class SimulationCacheService:
    """
    Service for caching Monte Carlo simulation results in Redis.
    
    Provides:
    - Result caching with configurable TTL
    - Cache invalidation based on risk data changes
    - Background processing queue management
    - Cache statistics and monitoring
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize Simulation Cache Service.
        
        Args:
            redis_url: Redis connection URL (defaults to environment variable)
        """
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.redis_client: Optional[aioredis.Redis] = None
        self.cache_enabled = False
        
        # Cache configuration
        self.default_ttl = 3600  # 1 hour default TTL
        self.max_cache_size = 100 * 1024 * 1024  # 100MB max per entry
        
        # Cache key prefixes
        self.SIMULATION_PREFIX = "simulation:result:"
        self.RISK_HASH_PREFIX = "simulation:risk_hash:"
        self.PROJECT_SIMS_PREFIX = "simulation:project:"
        self.QUEUE_PREFIX = "simulation:queue:"
        
        logger.info("Simulation Cache Service initialized")
    
    async def initialize(self):
        """Initialize Redis connection."""
        try:
            self.redis_client = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=False,  # We'll handle binary data
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self.redis_client.ping()
            self.cache_enabled = True
            logger.info("Redis cache initialized successfully")
        except Exception as e:
            logger.warning(f"Redis cache initialization failed: {e}. Caching disabled.")
            self.cache_enabled = False
    
    async def close(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis cache connection closed")
    
    def _generate_cache_key(self, simulation_id: str) -> str:
        """Generate cache key for simulation result."""
        return f"{self.SIMULATION_PREFIX}{simulation_id}"
    
    def _generate_risk_hash_key(self, project_id: UUID) -> str:
        """Generate cache key for project risk hash."""
        return f"{self.RISK_HASH_PREFIX}{str(project_id)}"
    
    def _generate_project_sims_key(self, project_id: UUID) -> str:
        """Generate cache key for project simulations list."""
        return f"{self.PROJECT_SIMS_PREFIX}{str(project_id)}"
    
    def _calculate_risk_hash(self, risks_data: List[Dict[str, Any]]) -> str:
        """
        Calculate hash of risk data for cache invalidation.
        
        Args:
            risks_data: List of risk dictionaries
            
        Returns:
            Hash string representing the risk configuration
        """
        # Sort risks by ID for consistent hashing
        sorted_risks = sorted(risks_data, key=lambda r: r.get('id', ''))
        
        # Create deterministic string representation
        risk_str = json.dumps(sorted_risks, sort_keys=True)
        
        # Calculate SHA256 hash
        return hashlib.sha256(risk_str.encode()).hexdigest()
    
    async def cache_simulation_result(
        self,
        simulation_id: str,
        results: SimulationResults,
        project_id: UUID,
        risks_data: List[Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache simulation results in Redis.
        
        Args:
            simulation_id: Unique simulation identifier
            results: SimulationResults object to cache
            project_id: Associated project UUID
            risks_data: Risk data used for the simulation
            ttl: Time-to-live in seconds (defaults to default_ttl)
            
        Returns:
            True if caching succeeded, False otherwise
        """
        if not self.cache_enabled or not self.redis_client:
            logger.debug("Cache not enabled, skipping cache storage")
            return False
        
        try:
            # Serialize results using pickle for numpy array support
            serialized_results = pickle.dumps(results)
            
            # Check size limit
            if len(serialized_results) > self.max_cache_size:
                logger.warning(f"Simulation result too large to cache: {len(serialized_results)} bytes")
                return False
            
            # Store simulation result
            cache_key = self._generate_cache_key(simulation_id)
            ttl_seconds = ttl or self.default_ttl
            
            await self.redis_client.setex(
                cache_key,
                ttl_seconds,
                serialized_results
            )
            
            # Store risk hash for invalidation tracking
            risk_hash = self._calculate_risk_hash(risks_data)
            risk_hash_key = self._generate_risk_hash_key(project_id)
            await self.redis_client.setex(
                risk_hash_key,
                ttl_seconds,
                risk_hash.encode()
            )
            
            # Add to project simulations set
            project_sims_key = self._generate_project_sims_key(project_id)
            await self.redis_client.sadd(project_sims_key, simulation_id)
            await self.redis_client.expire(project_sims_key, ttl_seconds)
            
            # Store metadata
            metadata = {
                "simulation_id": simulation_id,
                "project_id": str(project_id),
                "cached_at": datetime.now().isoformat(),
                "risk_hash": risk_hash,
                "iteration_count": results.iteration_count,
                "execution_time": results.execution_time
            }
            metadata_key = f"{cache_key}:metadata"
            await self.redis_client.setex(
                metadata_key,
                ttl_seconds,
                json.dumps(metadata).encode()
            )
            
            logger.info(f"Cached simulation result {simulation_id} for project {project_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache simulation result: {e}")
            return False
    
    async def get_cached_result(self, simulation_id: str) -> Optional[SimulationResults]:
        """
        Retrieve cached simulation result.
        
        Args:
            simulation_id: Unique simulation identifier
            
        Returns:
            SimulationResults object if found, None otherwise
        """
        if not self.cache_enabled or not self.redis_client:
            return None
        
        try:
            cache_key = self._generate_cache_key(simulation_id)
            cached_data = await self.redis_client.get(cache_key)
            
            if cached_data is None:
                logger.debug(f"Cache miss for simulation {simulation_id}")
                return None
            
            # Deserialize results
            results = pickle.loads(cached_data)
            logger.info(f"Cache hit for simulation {simulation_id}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to retrieve cached result: {e}")
            return None
    
    async def invalidate_project_cache(self, project_id: UUID) -> int:
        """
        Invalidate all cached simulations for a project.
        
        Args:
            project_id: Project UUID
            
        Returns:
            Number of cache entries invalidated
        """
        if not self.cache_enabled or not self.redis_client:
            return 0
        
        try:
            # Get all simulation IDs for this project
            project_sims_key = self._generate_project_sims_key(project_id)
            simulation_ids = await self.redis_client.smembers(project_sims_key)
            
            if not simulation_ids:
                logger.debug(f"No cached simulations found for project {project_id}")
                return 0
            
            # Delete all simulation results and metadata
            keys_to_delete = []
            for sim_id_bytes in simulation_ids:
                sim_id = sim_id_bytes.decode() if isinstance(sim_id_bytes, bytes) else sim_id_bytes
                cache_key = self._generate_cache_key(sim_id)
                keys_to_delete.append(cache_key)
                keys_to_delete.append(f"{cache_key}:metadata")
            
            # Delete risk hash
            risk_hash_key = self._generate_risk_hash_key(project_id)
            keys_to_delete.append(risk_hash_key)
            
            # Delete project simulations set
            keys_to_delete.append(project_sims_key)
            
            # Batch delete
            deleted_count = await self.redis_client.delete(*keys_to_delete)
            
            logger.info(f"Invalidated {deleted_count} cache entries for project {project_id}")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Failed to invalidate project cache: {e}")
            return 0
    
    async def check_risk_data_changed(
        self,
        project_id: UUID,
        current_risks_data: List[Dict[str, Any]]
    ) -> bool:
        """
        Check if risk data has changed since last simulation.
        
        Args:
            project_id: Project UUID
            current_risks_data: Current risk data
            
        Returns:
            True if risk data has changed, False otherwise
        """
        if not self.cache_enabled or not self.redis_client:
            return True  # Assume changed if cache not available
        
        try:
            # Get stored risk hash
            risk_hash_key = self._generate_risk_hash_key(project_id)
            stored_hash = await self.redis_client.get(risk_hash_key)
            
            if stored_hash is None:
                return True  # No previous hash, consider changed
            
            # Calculate current hash
            current_hash = self._calculate_risk_hash(current_risks_data)
            stored_hash_str = stored_hash.decode() if isinstance(stored_hash, bytes) else stored_hash
            
            changed = current_hash != stored_hash_str
            
            if changed:
                logger.info(f"Risk data changed for project {project_id}")
            
            return changed
            
        except Exception as e:
            logger.error(f"Failed to check risk data changes: {e}")
            return True  # Assume changed on error
    
    async def queue_background_simulation(
        self,
        project_id: UUID,
        simulation_config: Dict[str, Any],
        priority: int = 0
    ) -> str:
        """
        Queue a simulation for background processing.
        
        Args:
            project_id: Project UUID
            simulation_config: Simulation configuration dictionary
            priority: Priority level (higher = more urgent)
            
        Returns:
            Queue job ID
        """
        if not self.cache_enabled or not self.redis_client:
            raise RuntimeError("Cache not enabled, cannot queue background jobs")
        
        try:
            # Generate job ID
            job_id = f"job:{project_id}:{datetime.now().timestamp()}"
            
            # Create job data
            job_data = {
                "job_id": job_id,
                "project_id": str(project_id),
                "simulation_config": simulation_config,
                "priority": priority,
                "queued_at": datetime.now().isoformat(),
                "status": "queued"
            }
            
            # Add to priority queue (sorted set)
            queue_key = f"{self.QUEUE_PREFIX}pending"
            await self.redis_client.zadd(
                queue_key,
                {json.dumps(job_data): priority}
            )
            
            # Store job details
            job_key = f"{self.QUEUE_PREFIX}{job_id}"
            await self.redis_client.setex(
                job_key,
                86400,  # 24 hour TTL for job data
                json.dumps(job_data).encode()
            )
            
            logger.info(f"Queued background simulation job {job_id} for project {project_id}")
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to queue background simulation: {e}")
            raise
    
    async def get_next_queued_simulation(self) -> Optional[Dict[str, Any]]:
        """
        Get next simulation from the queue (highest priority).
        
        Returns:
            Job data dictionary or None if queue is empty
        """
        if not self.cache_enabled or not self.redis_client:
            return None
        
        try:
            queue_key = f"{self.QUEUE_PREFIX}pending"
            
            # Get highest priority job (ZPOPMAX gets highest score)
            result = await self.redis_client.zpopmax(queue_key, count=1)
            
            if not result:
                return None
            
            # Parse job data
            job_json, priority = result[0]
            job_data = json.loads(job_json)
            
            # Update job status
            job_key = f"{self.QUEUE_PREFIX}{job_data['job_id']}"
            job_data['status'] = 'processing'
            job_data['started_at'] = datetime.now().isoformat()
            await self.redis_client.setex(
                job_key,
                86400,
                json.dumps(job_data).encode()
            )
            
            logger.info(f"Dequeued simulation job {job_data['job_id']}")
            return job_data
            
        except Exception as e:
            logger.error(f"Failed to get next queued simulation: {e}")
            return None
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """
        Get cache statistics and metrics.
        
        Returns:
            Dictionary containing cache statistics
        """
        if not self.cache_enabled or not self.redis_client:
            return {
                "cache_enabled": False,
                "error": "Cache not available"
            }
        
        try:
            # Get all simulation keys
            simulation_keys = []
            cursor = 0
            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor,
                    match=f"{self.SIMULATION_PREFIX}*",
                    count=100
                )
                simulation_keys.extend(keys)
                if cursor == 0:
                    break
            
            # Calculate total cache size
            total_size = 0
            for key in simulation_keys:
                if not key.endswith(b':metadata'):
                    size = await self.redis_client.memory_usage(key)
                    if size:
                        total_size += size
            
            # Get queue statistics
            queue_key = f"{self.QUEUE_PREFIX}pending"
            queue_size = await self.redis_client.zcard(queue_key)
            
            # Get Redis info
            info = await self.redis_client.info('memory')
            
            return {
                "cache_enabled": True,
                "cached_simulations": len([k for k in simulation_keys if not k.endswith(b':metadata')]) // 2,
                "total_cache_size_bytes": total_size,
                "total_cache_size_mb": round(total_size / (1024 * 1024), 2),
                "queued_jobs": queue_size,
                "redis_used_memory": info.get('used_memory_human', 'unknown'),
                "redis_peak_memory": info.get('used_memory_peak_human', 'unknown')
            }
            
        except Exception as e:
            logger.error(f"Failed to get cache statistics: {e}")
            return {
                "cache_enabled": True,
                "error": str(e)
            }


# Global cache service instance
_cache_service: Optional[SimulationCacheService] = None


async def get_cache_service() -> SimulationCacheService:
    """Get or create global cache service instance."""
    global _cache_service
    
    if _cache_service is None:
        _cache_service = SimulationCacheService()
        await _cache_service.initialize()
    
    return _cache_service


async def close_cache_service():
    """Close global cache service instance."""
    global _cache_service
    
    if _cache_service is not None:
        await _cache_service.close()
        _cache_service = None
