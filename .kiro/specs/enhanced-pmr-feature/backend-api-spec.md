# Enhanced PMR Backend API Specification

## API Endpoints

### PMR Management

#### POST /api/reports/pmr/generate
Generate a new Enhanced PMR with AI insights

**Request Body:**
```json
{
  "project_id": "uuid",
  "report_month": "2024-01",
  "report_year": 2024,
  "template_id": "uuid",
  "title": "Project Alpha Monthly Report",
  "description": "Monthly status report for Project Alpha",
  "include_ai_insights": true,
  "include_monte_carlo": true,
  "custom_sections": [
    {
      "section_id": "executive_summary",
      "ai_generated": true,
      "content_type": "natural_language"
    }
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "generating",
  "estimated_completion": "2024-01-10T15:30:00Z",
  "generation_job_id": "uuid"
}
```

#### GET /api/reports/pmr/{report_id}
Retrieve Enhanced PMR with all sections and insights

**Response:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "title": "Project Alpha Monthly Report",
  "status": "completed",
  "sections": [
    {
      "section_id": "executive_summary",
      "title": "Executive Summary",
      "content": {
        "ai_generated_summary": "Project Alpha is performing 15% above baseline...",
        "key_metrics": {
          "budget_utilization": 0.78,
          "schedule_performance": 1.12,
          "risk_score": 0.23
        },
        "confidence_score": 0.94
      }
    }
  ],
  "ai_insights": [
    {
      "insight_type": "prediction",
      "category": "budget",
      "title": "Budget Variance Prediction",
      "content": "Based on current spending patterns, project is likely to finish 8% under budget",
      "confidence_score": 0.87,
      "supporting_data": {
        "historical_variance": [-0.02, 0.05, -0.03],
        "trend_analysis": "decreasing_variance"
      },
      "recommended_actions": [
        "Consider reallocating surplus budget to quality improvements",
        "Evaluate opportunities for scope expansion"
      ]
    }
  ],
  "monte_carlo_analysis": {
    "budget_completion": {
      "p50": 0.92,
      "p80": 0.96,
      "p95": 1.02
    },
    "schedule_completion": {
      "p50": "2024-03-15",
      "p80": "2024-03-22",
      "p95": "2024-04-05"
    }
  },
  "version": 1,
  "last_modified": "2024-01-10T14:30:00Z",
  "generated_at": "2024-01-10T14:25:00Z"
}
```

### Interactive Editing

#### POST /api/reports/pmr/{report_id}/edit/chat
Start or continue a chat-based editing session

**Request Body:**
```json
{
  "message": "Update the executive summary to highlight the recent milestone achievement",
  "session_id": "uuid",
  "context": {
    "current_section": "executive_summary",
    "user_role": "project_manager"
  }
}
```

**Response:**
```json
{
  "response": "I've updated the executive summary to emphasize the milestone achievement. The new summary highlights that Project Alpha successfully completed Phase 2 deliverables 3 days ahead of schedule, contributing to the overall positive performance metrics.",
  "changes_applied": [
    {
      "section_id": "executive_summary",
      "change_type": "content_update",
      "old_content": "Project Alpha is performing 15% above baseline...",
      "new_content": "Project Alpha achieved a significant milestone by completing Phase 2 deliverables 3 days ahead of schedule, demonstrating 15% above baseline performance...",
      "confidence": 0.92
    }
  ],
  "session_id": "uuid",
  "suggestions": [
    {
      "type": "enhancement",
      "content": "Consider adding a visual timeline showing milestone achievements",
      "section": "project_timeline"
    }
  ]
}
```

#### PUT /api/reports/pmr/{report_id}/sections/{section_id}
Direct section update

**Request Body:**
```json
{
  "content": {
    "title": "Updated Section Title",
    "body": "Updated section content...",
    "metrics": {
      "key_metric": 0.85
    }
  },
  "merge_strategy": "replace"
}
```

### AI Insights and Analysis

#### POST /api/reports/pmr/{report_id}/insights/generate
Generate additional AI insights

**Request Body:**
```json
{
  "insight_types": ["prediction", "recommendation", "alert"],
  "categories": ["budget", "schedule", "resource", "risk"],
  "context": {
    "focus_areas": ["cost_optimization", "risk_mitigation"],
    "time_horizon": "3_months"
  }
}
```

#### POST /api/reports/pmr/{report_id}/monte-carlo
Run Monte Carlo analysis

**Request Body:**
```json
{
  "analysis_type": "budget_variance",
  "iterations": 10000,
  "confidence_levels": [0.5, 0.8, 0.95],
  "parameters": {
    "budget_uncertainty": 0.15,
    "schedule_uncertainty": 0.20,
    "resource_availability": 0.90
  }
}
```

### Export and Templates

#### POST /api/reports/pmr/{report_id}/export
Export PMR in specified format

**Request Body:**
```json
{
  "format": "pdf",
  "template_id": "uuid",
  "options": {
    "include_charts": true,
    "include_raw_data": false,
    "branding": {
      "logo_url": "https://company.com/logo.png",
      "color_scheme": "corporate_blue"
    },
    "sections": ["executive_summary", "ai_insights", "charts"]
  }
}
```

**Response:**
```json
{
  "export_job_id": "uuid",
  "status": "processing",
  "estimated_completion": "2024-01-10T15:35:00Z",
  "download_url": null
}
```

#### GET /api/reports/pmr/templates
List available PMR templates

**Response:**
```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Executive Dashboard Template",
      "description": "High-level overview focused on KPIs and strategic metrics",
      "template_type": "executive",
      "industry_focus": "technology",
      "sections": [
        {
          "section_id": "executive_summary",
          "title": "Executive Summary",
          "ai_suggestions": {
            "content_type": "natural_language_summary",
            "include_predictions": true,
            "focus_areas": ["budget", "schedule", "risks"]
          }
        }
      ],
      "export_formats": ["pdf", "slides", "excel"],
      "usage_count": 156,
      "rating": 4.8
    }
  ]
}
```

### Collaboration

#### POST /api/reports/pmr/{report_id}/collaborate
Start collaborative editing session

**Request Body:**
```json
{
  "session_type": "collaborative",
  "participants": ["user1@company.com", "user2@company.com"],
  "permissions": {
    "user1@company.com": "edit",
    "user2@company.com": "comment"
  }
}
```

#### WebSocket: /ws/reports/pmr/{report_id}/collaborate
Real-time collaboration events

**Message Types:**
```json
{
  "type": "section_update",
  "section_id": "executive_summary",
  "user_id": "uuid",
  "changes": {
    "content": "Updated content...",
    "timestamp": "2024-01-10T15:30:00Z"
  }
}

{
  "type": "user_cursor",
  "user_id": "uuid",
  "section_id": "budget_analysis",
  "position": 145
}

{
  "type": "comment_added",
  "comment_id": "uuid",
  "section_id": "risk_assessment",
  "content": "Consider adding mitigation strategies",
  "user_id": "uuid"
}
```

## Data Models

### Enhanced PMR Report
```python
class EnhancedPMRReport(PMRReportBase):
    ai_insights: List[AIInsight]
    monte_carlo_analysis: Optional[MonteCarloResults]
    collaboration_session: Optional[CollaborationSession]
    export_history: List[ExportJob]
    template_customizations: Dict[str, Any]
    real_time_metrics: Dict[str, Any]
    confidence_scores: Dict[str, float]
```

### AI Insight
```python
class AIInsight(BaseModel):
    insight_type: AIInsightType  # prediction, recommendation, alert, summary
    category: AIInsightCategory  # budget, schedule, resource, risk, quality
    title: str
    content: str
    confidence_score: float
    supporting_data: Dict[str, Any]
    predicted_impact: Optional[str]
    recommended_actions: List[str]
    priority: AIInsightPriority
    validation_status: ValidationStatus
    generated_at: datetime
```

### Collaboration Session
```python
class CollaborationSession(BaseModel):
    session_id: str
    report_id: UUID
    participants: List[CollaborationParticipant]
    active_editors: List[str]
    session_type: SessionType  # chat, direct, collaborative
    started_at: datetime
    last_activity: datetime
    changes_log: List[ChangeEvent]
    comments: List[Comment]
```

## Service Architecture

### PMR Orchestration Service
- Coordinates AI insight generation
- Manages collaborative editing sessions
- Handles export pipeline orchestration
- Integrates with existing RAG agent

### AI Insights Engine
- Leverages existing RAG patterns
- Integrates with project data models
- Generates predictive analytics
- Provides confidence scoring

### Real-Time Collaboration Service
- WebSocket connection management
- Conflict resolution algorithms
- Change synchronization
- User presence tracking

### Export Pipeline Service
- Template rendering engine
- Multi-format conversion
- Branding and customization
- Quality assurance checks

## Integration Points

### Existing Services
- **RAG Agent**: Leverage for AI-powered content generation
- **Project Models**: Source data for insights and analysis
- **Chart Components**: Embed interactive visualizations
- **User Management**: Authentication and permissions

### Database Schema Extensions
- New tables for PMR-specific data
- Extend existing project tables with PMR metadata
- Collaboration and export tracking tables
- AI insights and analysis results storage

## Performance Considerations

- **Caching Strategy**: Redis for frequently accessed reports
- **Async Processing**: Celery for long-running AI operations
- **Database Optimization**: Indexed queries for large datasets
- **WebSocket Scaling**: Redis pub/sub for multi-instance support

## Security and Compliance

- **Data Privacy**: Ensure sensitive project data protection
- **Access Control**: Role-based permissions for report access
- **Audit Trail**: Complete change history and user actions
- **Export Security**: Watermarking and access controls on exports