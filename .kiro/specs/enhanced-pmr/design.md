# Enhanced Project Monthly Report (PMR) - Design Document

## Introduction

This document outlines the design for an AI-powered, interactive Project Monthly Report system that extends the existing PPM platform with intelligent report generation, real-time collaboration, and multi-format export capabilities. The system leverages the existing FastAPI backend, Next.js frontend, and integrates with current AI agents and RAG capabilities.

## Architecture Overview

The Enhanced PMR system follows the existing architecture pattern, integrating seamlessly with current services while adding new AI-powered capabilities.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  PMR Dashboard          │  Interactive Report Editor       │
│  Template Manager       │  Export Interface                │
│  Collaboration Tools    │  Real-time Preview              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                      │
├─────────────────────────────────────────────────────────────┤
│  /reports/pmr/*         │  /ai/pmr-insights/*             │
│  /templates/*           │  /exports/*                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│  PMR Generator Service  │  AI Insights Engine             │
│  Template Manager       │  Multi-Format Exporter         │
│  Interactive Editor     │  RAG Context Provider          │
│  Validation Engine      │  Screenshot Service             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                │
├─────────────────────────────────────────────────────────────┤
│  PMR Tables            │  Template Tables                 │
│  Export Cache          │  Collaboration Data              │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

### Core PMR Models

#### PMR Report Model
```python
class PMRReport(BaseModel):
    id: UUID
    project_id: UUID
    report_month: date
    report_year: int
    template_id: UUID
    title: str
    executive_summary: str
    ai_generated_insights: List[Dict[str, Any]]
    sections: List[Dict[str, Any]]  # Flexible section structure
    metrics: Dict[str, Any]
    visualizations: List[Dict[str, Any]]
    status: str  # "draft", "review", "approved", "distributed"
    generated_by: UUID
    approved_by: Optional[UUID]
    generated_at: datetime
    last_modified: datetime
    version: int
    is_active: bool = True
```

#### PMR Template Model
```python
class PMRTemplate(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    template_type: str  # "executive", "technical", "financial", "custom"
    industry_focus: Optional[str]
    sections: List[Dict[str, Any]]  # Template section definitions
    default_metrics: List[str]
    ai_suggestions: Dict[str, Any]
    branding_config: Dict[str, Any]
    export_formats: List[str]
    is_public: bool = False
    created_by: UUID
    organization_id: Optional[UUID]
    usage_count: int = 0
    rating: Optional[float]
    created_at: datetime
    updated_at: datetime
```

#### AI Insight Model
```python
class AIInsight(BaseModel):
    id: UUID
    report_id: UUID
    insight_type: str  # "prediction", "recommendation", "alert", "summary"
    category: str  # "budget", "schedule", "resource", "risk", "quality"
    title: str
    content: str
    confidence_score: float
    supporting_data: Dict[str, Any]
    predicted_impact: Optional[str]
    recommended_actions: List[str]
    priority: str  # "low", "medium", "high", "critical"
    generated_at: datetime
    validated: bool = False
    validation_notes: Optional[str]
```

#### Interactive Edit Session Model
```python
class EditSession(BaseModel):
    id: UUID
    report_id: UUID
    user_id: UUID
    session_type: str  # "chat", "direct", "collaborative"
    chat_messages: List[Dict[str, Any]]
    changes_made: List[Dict[str, Any]]
    active_section: Optional[str]
    started_at: datetime
    last_activity: datetime
    is_active: bool = True
```

#### Export Job Model
```python
class ExportJob(BaseModel):
    id: UUID
    report_id: UUID
    export_format: str  # "pdf", "excel", "slides", "word", "powerpoint"
    template_config: Dict[str, Any]
    status: str  # "queued", "processing", "completed", "failed"
    file_url: Optional[str]
    file_size: Optional[int]
    export_options: Dict[str, Any]
    requested_by: UUID
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]
```

## API Endpoints

### PMR Reports Router (`/reports/pmr`)

#### Report Generation
```python
@router.post("/generate", response_model=PMRReportResponse)
async def generate_pmr_report(
    request: PMRGenerationRequest,
    current_user = Depends(get_current_user)
) -> PMRReportResponse

@router.get("/{project_id}/reports")
async def list_project_pmr_reports(
    project_id: UUID,
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user = Depends(get_current_user)
) -> List[PMRReportResponse]

@router.get("/{report_id}")
async def get_pmr_report(
    report_id: UUID,
    current_user = Depends(get_current_user)
) -> PMRReportResponse
```

#### Interactive Editing
```python
@router.post("/{report_id}/edit/chat")
async def chat_edit_report(
    report_id: UUID,
    message: str,
    session_id: Optional[str] = None,
    current_user = Depends(get_current_user)
) -> ChatEditResponse

@router.post("/{report_id}/edit/section")
async def update_report_section(
    report_id: UUID,
    section_update: SectionUpdateRequest,
    current_user = Depends(get_current_user)
) -> SectionUpdateResponse

@router.get("/{report_id}/edit/suggestions")
async def get_ai_suggestions(
    report_id: UUID,
    section: Optional[str] = None,
    current_user = Depends(get_current_user)
) -> AISuggestionsResponse
```

### Templates Router (`/reports/pmr/templates`)

#### Template Management
```python
@router.post("/", response_model=PMRTemplateResponse)
async def create_pmr_template(
    template_data: PMRTemplateCreate,
    current_user = Depends(get_current_user)
) -> PMRTemplateResponse

@router.get("/")
async def list_pmr_templates(
    template_type: Optional[str] = None,
    industry: Optional[str] = None,
    current_user = Depends(get_current_user)
) -> List[PMRTemplateResponse]

@router.get("/{template_id}/ai-suggestions")
async def get_template_ai_suggestions(
    template_id: UUID,
    project_type: Optional[str] = None,
    current_user = Depends(get_current_user)
) -> TemplateAISuggestionsResponse
```

### Export Router (`/reports/pmr/export`)

#### Multi-Format Export
```python
@router.post("/{report_id}/export")
async def export_pmr_report(
    report_id: UUID,
    export_request: ExportRequest,
    current_user = Depends(get_current_user)
) -> ExportJobResponse

@router.get("/jobs/{job_id}/status")
async def get_export_status(
    job_id: UUID,
    current_user = Depends(get_current_user)
) -> ExportJobResponse

@router.get("/jobs/{job_id}/download")
async def download_exported_report(
    job_id: UUID,
    current_user = Depends(get_current_user)
) -> FileResponse
```

### AI Insights Router (`/ai/pmr-insights`)

#### AI-Powered Analysis
```python
@router.post("/generate")
async def generate_ai_insights(
    insights_request: AIInsightsRequest,
    current_user = Depends(get_current_user)
) -> AIInsightsResponse

@router.post("/validate")
async def validate_report_accuracy(
    validation_request: ValidationRequest,
    current_user = Depends(get_current_user)
) -> ValidationResponse

@router.post("/monte-carlo")
async def run_monte_carlo_analysis(
    analysis_request: MonteCarloRequest,
    current_user = Depends(get_current_user)
) -> MonteCarloResponse
```

## Service Layer Design

### PMR Generator Service

```python
class PMRGeneratorService:
    def __init__(self, supabase: Client, openai_client: OpenAI, rag_agent: HelpRAGAgent):
        self.supabase = supabase
        self.openai_client = openai_client
        self.rag_agent = rag_agent
        
    async def generate_monthly_report(self, project_id: UUID, month: date, 
                                    template_id: UUID, user_id: UUID) -> PMRReport:
        """Generate comprehensive monthly project report with AI insights"""
        
    async def aggregate_project_data(self, project_id: UUID, month: date) -> Dict[str, Any]:
        """Aggregate data from all relevant project sources"""
        
    async def generate_executive_summary(self, project_data: Dict[str, Any]) -> str:
        """Generate AI-powered executive summary"""
        
    async def create_ai_insights(self, project_data: Dict[str, Any]) -> List[AIInsight]:
        """Generate predictive insights and recommendations"""
        
    async def validate_report_accuracy(self, report: PMRReport) -> ValidationResult:
        """Validate report accuracy against source data"""
```

### AI Insights Engine Service

```python
class AIInsightsEngineService:
    def __init__(self, supabase: Client, openai_client: OpenAI):
        self.supabase = supabase
        self.openai_client = openai_client
        
    async def generate_predictive_insights(self, project_data: Dict[str, Any]) -> List[AIInsight]:
        """Generate predictive analytics and forecasts"""
        
    async def analyze_budget_variance(self, financial_data: Dict[str, Any]) -> AIInsight:
        """Analyze budget performance and predict future variance"""
        
    async def assess_resource_risks(self, resource_data: Dict[str, Any]) -> AIInsight:
        """Assess resource allocation risks and conflicts"""
        
    async def forecast_completion(self, schedule_data: Dict[str, Any]) -> AIInsight:
        """Forecast project completion with confidence intervals"""
        
    async def run_monte_carlo_simulation(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run Monte Carlo simulation for variance analysis"""
```

### Interactive Editor Service

```python
class InteractiveEditorService:
    def __init__(self, supabase: Client, openai_client: OpenAI):
        self.supabase = supabase
        self.openai_client = openai_client
        
    async def process_chat_edit(self, report_id: UUID, message: str, 
                              user_id: UUID, session_id: str) -> ChatEditResponse:
        """Process natural language editing commands"""
        
    async def update_report_section(self, report_id: UUID, section: str, 
                                  content: Dict[str, Any], user_id: UUID) -> bool:
        """Update specific report section with new content"""
        
    async def generate_content_suggestions(self, report_id: UUID, 
                                         section: str) -> List[Dict[str, Any]]:
        """Generate AI-powered content suggestions"""
        
    async def track_collaborative_changes(self, report_id: UUID, 
                                        changes: List[Dict[str, Any]]) -> bool:
        """Track and merge collaborative editing changes"""
```

### Multi-Format Exporter Service

```python
class MultiFormatExporterService:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.supported_formats = ["pdf", "excel", "slides", "word", "powerpoint"]
        
    async def export_to_pdf(self, report: PMRReport, template_config: Dict[str, Any]) -> str:
        """Export report to PDF with custom styling"""
        
    async def export_to_excel(self, report: PMRReport, template_config: Dict[str, Any]) -> str:
        """Export report to Excel with interactive features"""
        
    async def export_to_slides(self, report: PMRReport, template_config: Dict[str, Any]) -> str:
        """Export report to Google Slides/PowerPoint"""
        
    async def capture_dashboard_screenshots(self, project_id: UUID) -> List[str]:
        """Capture automated screenshots of relevant dashboards"""
        
    async def generate_visualizations(self, report_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate custom charts and visualizations"""
```

## Frontend Components

### PMR Dashboard

```typescript
// app/reports/pmr/page.tsx
interface PMRDashboardProps {
  projects: Project[]
  recentReports: PMRReport[]
  templates: PMRTemplate[]
}

// Key features:
// - Project selection and month picker
// - Recent reports grid with status indicators
// - Quick generation buttons
// - Template preview and selection
// - Export status monitoring
```

### Interactive Report Editor

```typescript
// components/pmr/InteractiveReportEditor.tsx
interface InteractiveReportEditorProps {
  report: PMRReport
  onSave: (report: PMRReport) => void
  onExport: (format: string) => void
}

// Key features:
// - Real-time collaborative editing
// - AI chat interface for modifications
// - Section-by-section editing
// - Live preview with auto-save
// - Version history and change tracking
// - AI suggestion panels
```

### Template Manager

```typescript
// components/pmr/TemplateManager.tsx
interface TemplateManagerProps {
  templates: PMRTemplate[]
  onCreateTemplate: (template: PMRTemplateCreate) => void
  onSelectTemplate: (templateId: string) => void
}

// Key features:
// - Template gallery with previews
// - AI-suggested templates based on project type
// - Custom template builder
// - Template sharing and collaboration
// - Usage analytics and ratings
```

### Export Interface

```typescript
// components/pmr/ExportInterface.tsx
interface ExportInterfaceProps {
  report: PMRReport
  availableFormats: string[]
  onExport: (format: string, options: ExportOptions) => void
}

// Key features:
// - Multi-format export options
// - Template customization
// - Branding configuration
// - Export preview
// - Batch export capabilities
// - Download management
```

## Database Schema

### PMR Tables

```sql
-- PMR Reports
CREATE TABLE pmr_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    report_month DATE NOT NULL,
    report_year INTEGER NOT NULL,
    template_id UUID NOT NULL REFERENCES pmr_templates(id),
    title VARCHAR(255) NOT NULL,
    executive_summary TEXT,
    ai_generated_insights JSONB,
    sections JSONB NOT NULL,
    metrics JSONB,
    visualizations JSONB,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'distributed')),
    generated_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMP DEFAULT NOW(),
    last_modified TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, report_month, report_year, version)
);

-- PMR Templates
CREATE TABLE pmr_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('executive', 'technical', 'financial', 'custom')),
    industry_focus VARCHAR(100),
    sections JSONB NOT NULL,
    default_metrics JSONB,
    ai_suggestions JSONB,
    branding_config JSONB,
    export_formats JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID,
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI Insights
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN ('prediction', 'recommendation', 'alert', 'summary')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('budget', 'schedule', 'resource', 'risk', 'quality')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    supporting_data JSONB,
    predicted_impact TEXT,
    recommended_actions JSONB,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    generated_at TIMESTAMP DEFAULT NOW(),
    validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Interactive Edit Sessions
CREATE TABLE edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_type VARCHAR(20) DEFAULT 'chat' CHECK (session_type IN ('chat', 'direct', 'collaborative')),
    chat_messages JSONB,
    changes_made JSONB,
    active_section VARCHAR(100),
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Export Jobs
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    export_format VARCHAR(20) NOT NULL CHECK (export_format IN ('pdf', 'excel', 'slides', 'word', 'powerpoint')),
    template_config JSONB,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    file_url TEXT,
    file_size INTEGER,
    export_options JSONB,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes for Performance

```sql
-- Performance indexes
CREATE INDEX idx_pmr_reports_project_month ON pmr_reports(project_id, report_month DESC);
CREATE INDEX idx_pmr_reports_status ON pmr_reports(status, generated_at DESC);
CREATE INDEX idx_pmr_templates_type ON pmr_templates(template_type, is_public);
CREATE INDEX idx_ai_insights_report ON ai_insights(report_id, priority DESC);
CREATE INDEX idx_edit_sessions_active ON edit_sessions(report_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_export_jobs_status ON export_jobs(status, started_at DESC);
```

## Integration Points

### Existing System Integration

1. **Project Data Integration**
   - Sync with projects, portfolios, resources, risks, issues tables
   - Integrate with financial tracking and budget systems
   - Connect with milestone and schedule data

2. **AI Services Integration**
   - Leverage existing RAG agent for contextual insights
   - Integrate with help chat AI for natural language processing
   - Use existing AI feedback and analytics systems

3. **Export Integration**
   - Extend existing Google Suite report generation
   - Integrate with current file storage and management
   - Connect with notification and distribution systems

4. **Authentication Integration**
   - Use existing RBAC system for permissions
   - Integrate with current user management
   - Leverage existing audit and compliance tracking

## Correctness Properties

### Property 1: Data Aggregation Accuracy
**Property**: All PMR reports must accurately aggregate data from source systems
**Validation**: 
- Report metrics match source data within acceptable tolerance
- All referenced projects, resources, and financial data exist
- Temporal data alignment is correct for the reporting period

### Property 2: AI Insight Reliability
**Property**: AI-generated insights must be validated against actual project data
**Validation**:
- Predictive insights are based on sufficient historical data
- Confidence scores accurately reflect prediction reliability
- Recommendations are actionable and contextually appropriate

### Property 3: Template Consistency
**Property**: Report generation must consistently apply template configurations
**Validation**:
- All template sections are properly populated
- Branding and formatting are consistently applied
- Export formats maintain template fidelity

### Property 4: Interactive Edit Integrity
**Property**: Interactive editing must maintain report data integrity
**Validation**:
- Chat commands are correctly interpreted and applied
- Collaborative changes are properly merged
- Version history is accurately maintained

### Property 5: Export Format Fidelity
**Property**: Multi-format exports must maintain content and formatting accuracy
**Validation**:
- All report content is preserved across formats
- Visualizations render correctly in target formats
- Interactive elements function as expected

## Security and Performance

### Security Considerations
- Role-based access control for report generation and editing
- Data encryption for sensitive project information
- Audit trails for all report modifications and exports
- Secure file storage and download mechanisms

### Performance Optimization
- Caching of frequently accessed project data
- Asynchronous report generation and export processing
- Optimized database queries with proper indexing
- CDN integration for file downloads and static assets

### Scalability Features
- Horizontal scaling for export processing
- Queue management for high-volume report generation
- Database partitioning for large datasets
- Load balancing for concurrent editing sessions