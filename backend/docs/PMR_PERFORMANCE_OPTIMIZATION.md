# Enhanced PMR Performance Optimization

## Overview

This document describes the performance optimization features implemented for the Enhanced PMR (Project Monthly Report) system. These optimizations ensure scalability, responsiveness, and efficient resource utilization.

## Components

### 1. PMR Performance Optimizer (`pmr_performance_optimizer.py`)

Handles caching strategies and lazy loading for PMR data.

#### Features

- **Report Caching**: Multi-level caching for report metadata and full reports
- **Section Lazy Loading**: Individual section caching for on-demand loading
- **AI Insights Caching**: Cached AI insights with category filtering
- **Monte Carlo Results Caching**: Long-lived cache for expensive computations
- **Template Caching**: Cached templates with extended TTL
- **Collaboration Session Caching**: Short-lived cache for real-time data
- **Export Job Caching**: Status tracking for export operations

#### Cache TTL Configuration

```python
CACHE_TTL = {
    'report_metadata': 300,      # 5 minutes
    'report_full': 120,          # 2 minutes
    'ai_insights': 180,          # 3 minutes
    'monte_carlo': 600,          # 10 minutes
    'sections': 120,             # 2 minutes
    'templates': 1800,           # 30 minutes
    'collaboration': 30,         # 30 seconds (real-time)
    'export_jobs': 60            # 1 minute
}
```

#### Usage Example

```python
from services.pmr_performance_optimizer import PMRPerformanceOptimizer

# Initialize
optimizer = PMRPerformanceOptimizer(cache_manager, performance_monitor)

# Cache report metadata
await optimizer.cache_report_metadata(report_id, metadata)

# Retrieve cached metadata
cached = await optimizer.get_cached_report_metadata(report_id)

# Cache section for lazy loading
await optimizer.cache_section(report_id, section_id, section_data)

# Invalidate all cache for a report
await optimizer.invalidate_report_cache(report_id)
```

### 2. WebSocket Optimizer (`websocket_optimizer.py`)

Optimizes WebSocket connections for real-time collaboration.

#### Features

- **Connection Pooling**: Efficient management of WebSocket connections
- **Message Batching**: Batch multiple messages for reduced overhead
- **Idle Connection Cleanup**: Automatic cleanup of inactive connections
- **Heartbeat Mechanism**: Keep-alive messages to maintain connections
- **Connection Limits**: Per-session and global connection limits
- **Performance Metrics**: Detailed connection and message statistics

#### Configuration

```python
WebSocketOptimizer(
    max_connections=1000,              # Global connection limit
    max_connections_per_session=10,    # Per-session limit
    idle_timeout_seconds=300,          # 5 minutes idle timeout
    heartbeat_interval_seconds=30      # 30 second heartbeat
)
```

#### Usage Example

```python
from services.websocket_optimizer import WebSocketOptimizer

# Initialize
ws_optimizer = WebSocketOptimizer()
await ws_optimizer.start()

# Connect a WebSocket
success = await ws_optimizer.connect(websocket, connection_id, session_id)

# Send message
await ws_optimizer.send_message(connection_id, message, batch=True)

# Broadcast to session
await ws_optimizer.broadcast_to_session(session_id, message)

# Get statistics
stats = ws_optimizer.get_connection_stats()
```

### 3. PMR Performance Monitor (`pmr_performance_monitor.py`)

Monitors performance metrics and triggers alerts.

#### Features

- **Metric Recording**: Track various performance metrics
- **Threshold Monitoring**: Automatic threshold checking
- **Alert System**: Multi-level alerts (INFO, WARNING, ERROR, CRITICAL)
- **Performance Reports**: Comprehensive performance statistics
- **Health Status**: Quick health check endpoint

#### Monitored Metrics

- **Response Time**: API endpoint response times
- **Error Rate**: Error occurrence rate
- **Cache Hit Rate**: Cache effectiveness
- **WebSocket Connections**: Active connection count
- **Report Generation Time**: Time to generate reports
- **AI Insights Generation Time**: AI processing time
- **Monte Carlo Execution Time**: Simulation execution time

#### Thresholds

```python
# Response Time
warning: 1.0s, error: 3.0s, critical: 5.0s

# Error Rate
warning: 5%, error: 10%, critical: 20%

# Cache Hit Rate (inverted - lower is worse)
warning: 70%, error: 50%, critical: 30%

# Report Generation Time
warning: 10s, error: 20s, critical: 30s
```

#### Usage Example

```python
from services.pmr_performance_monitor import PMRPerformanceMonitor, MetricType

# Initialize
monitor = PMRPerformanceMonitor()
await monitor.start()

# Record metrics
monitor.record_response_time("/api/reports/pmr/generate", 2.5)
monitor.record_report_generation(report_id, 8.5)
monitor.record_cache_access(hit=True, cache_key="report:123")

# Get statistics
stats = monitor.get_metric_stats(MetricType.RESPONSE_TIME)

# Get health status
health = monitor.get_health_status()

# Get performance report
report = monitor.get_performance_report()
```

## API Endpoints

### Lazy Loading Endpoints

#### GET `/api/reports/pmr/{report_id}/sections/{section_id}/lazy`

Lazy load a specific section with caching.

**Response:**
```json
{
  "section_id": "executive_summary",
  "title": "Executive Summary",
  "content": "...",
  "cached": true,
  "load_time_ms": 15
}
```

#### GET `/api/reports/pmr/{report_id}/insights/lazy`

Lazy load AI insights with optional category filtering.

**Query Parameters:**
- `category` (optional): Filter by insight category

**Response:**
```json
{
  "insights": [...],
  "count": 15,
  "cached": true,
  "load_time_ms": 25
}
```

### Cache Management Endpoints

#### POST `/api/reports/pmr/{report_id}/cache/invalidate`

Invalidate all cache entries for a report.

**Response:**
```json
{
  "report_id": "uuid",
  "invalidated_count": 12,
  "timestamp": "2026-01-15T10:30:00Z"
}
```

### Performance Monitoring Endpoints

#### GET `/api/reports/pmr/performance/stats`

Get comprehensive performance statistics (admin only).

**Response:**
```json
{
  "timestamp": "2026-01-15T10:30:00Z",
  "pmr_optimizer": {
    "overall": {...},
    "pmr_specific": {...}
  },
  "websocket_optimizer": {
    "total_connections": 45,
    "capacity_used_percent": 4.5,
    "total_messages_sent": 1250,
    "avg_connection_duration_seconds": 180.5
  },
  "performance_monitor": {
    "metrics": {...},
    "active_alerts": [...],
    "health_status": "healthy"
  }
}
```

#### GET `/api/reports/pmr/performance/health`

Quick health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "components": {
    "pmr_optimizer": true,
    "websocket_optimizer": true,
    "performance_monitor": true
  },
  "active_alerts": 0
}
```

#### GET `/api/reports/pmr/performance/alerts`

Get performance alerts (admin only).

**Query Parameters:**
- `active_only` (default: true): Return only active alerts
- `limit` (default: 50): Number of alerts to return

**Response:**
```json
{
  "alerts": [
    {
      "id": "response_time_warning_1234567890",
      "metric_type": "response_time",
      "severity": "warning",
      "message": "WARNING: Response Time is 1.25s, exceeding threshold of 1.00s",
      "current_value": 1.25,
      "threshold_value": 1.0,
      "timestamp": "2026-01-15T10:30:00Z",
      "metadata": {...}
    }
  ],
  "count": 1,
  "timestamp": "2026-01-15T10:30:00Z"
}
```

## Frontend Integration

### Lazy Loading Component

```tsx
import { LazyPMRSection } from '@/components/pmr/LazyPMRSection'

<LazyPMRSection
  reportId={reportId}
  sectionId="executive_summary"
  sectionTitle="Executive Summary"
  onLoad={async (sectionId) => {
    const response = await fetch(
      `/api/reports/pmr/${reportId}/sections/${sectionId}/lazy`
    )
    return response.json()
  }}
  cacheEnabled={true}
  threshold={0.1}
>
  {(data, loading) => (
    <div>
      {loading ? <Spinner /> : <SectionContent data={data} />}
    </div>
  )}
</LazyPMRSection>
```

### Lazy Loading Hook

```tsx
import { useLazyAIInsights } from '@/hooks/useLazyAIInsights'

function AIInsightsPanel({ reportId }) {
  const {
    insights,
    isLoading,
    error,
    load,
    reload,
    fromCache
  } = useLazyAIInsights({
    reportId,
    category: 'budget',
    autoLoad: true,
    cacheEnabled: true
  })

  return (
    <div>
      {isLoading && <Spinner />}
      {error && <ErrorMessage error={error} />}
      {insights.map(insight => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
      {fromCache && <CacheIndicator />}
    </div>
  )
}
```

## Performance Best Practices

### 1. Use Lazy Loading

Load sections and insights on-demand rather than all at once:

```tsx
// Good: Lazy load sections
<LazyPMRSection onLoad={loadSection} />

// Bad: Load all sections upfront
const allSections = await loadAllSections()
```

### 2. Enable Caching

Always enable caching for frequently accessed data:

```python
# Cache report metadata
await optimizer.cache_report_metadata(report_id, metadata)

# Cache sections
await optimizer.cache_section(report_id, section_id, section_data)
```

### 3. Batch WebSocket Messages

Use message batching for high-frequency updates:

```python
# Batch messages for efficiency
await ws_optimizer.send_message(connection_id, message, batch=True)
```

### 4. Monitor Performance

Regularly check performance metrics and alerts:

```python
# Get health status
health = monitor.get_health_status()

# Check for alerts
alerts = monitor.get_active_alerts()
```

### 5. Invalidate Cache Appropriately

Invalidate cache after significant changes:

```python
# After updating report
await optimizer.invalidate_report_cache(report_id)
```

## Configuration

### Environment Variables

```bash
# Redis URL for caching (optional, falls back to memory cache)
REDIS_URL=redis://localhost:6379

# Performance monitoring settings
PMR_MAX_CONNECTIONS=1000
PMR_MAX_CONNECTIONS_PER_SESSION=10
PMR_IDLE_TIMEOUT_SECONDS=300
PMR_HEARTBEAT_INTERVAL_SECONDS=30
```

### Redis Setup (Optional)

For production deployments, Redis is recommended for distributed caching:

```bash
# Install Redis
brew install redis  # macOS
apt-get install redis-server  # Ubuntu

# Start Redis
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

## Monitoring and Alerting

### Health Check Integration

Integrate with monitoring systems:

```bash
# Health check endpoint
curl https://api.example.com/api/reports/pmr/performance/health

# Response
{
  "status": "healthy",
  "components": {
    "pmr_optimizer": true,
    "websocket_optimizer": true,
    "performance_monitor": true
  }
}
```

### Alert Webhooks

Configure alert handlers for notifications:

```python
async def alert_webhook_handler(alert: PerformanceAlert):
    """Send alert to webhook"""
    await send_to_slack(alert.message)
    await send_to_pagerduty(alert)

# Register handler
monitor.register_alert_handler(alert_webhook_handler)
```

## Performance Metrics

### Expected Performance

- **Report Generation**: < 10 seconds (with AI insights)
- **Section Load**: < 100ms (cached), < 500ms (uncached)
- **AI Insights Load**: < 200ms (cached), < 2 seconds (uncached)
- **WebSocket Message Latency**: < 50ms
- **Cache Hit Rate**: > 70%

### Scalability

- **Concurrent Users**: 1000+ simultaneous users
- **WebSocket Connections**: 1000+ concurrent connections
- **Reports per Hour**: 10,000+ report generations
- **Cache Size**: Configurable, typically 1-10GB

## Troubleshooting

### High Response Times

1. Check cache hit rate
2. Verify Redis connection
3. Review active alerts
4. Check database query performance

### Low Cache Hit Rate

1. Verify cache TTL settings
2. Check cache invalidation frequency
3. Review cache key generation
4. Monitor memory usage

### WebSocket Connection Issues

1. Check connection limits
2. Verify heartbeat mechanism
3. Review idle timeout settings
4. Check network connectivity

## Testing

Run performance optimization tests:

```bash
# Run all tests
python backend/test_pmr_performance_optimization.py

# Run with pytest
pytest backend/test_pmr_performance_optimization.py -v
```

## Future Enhancements

1. **Distributed Caching**: Multi-region cache replication
2. **Predictive Prefetching**: ML-based cache warming
3. **Adaptive Thresholds**: Dynamic threshold adjustment
4. **Advanced Batching**: Intelligent message batching
5. **Compression**: WebSocket message compression
6. **CDN Integration**: Static asset caching

## Support

For issues or questions:
- Check logs: `backend/backend.log`
- Review metrics: `/api/reports/pmr/performance/stats`
- Check alerts: `/api/reports/pmr/performance/alerts`
