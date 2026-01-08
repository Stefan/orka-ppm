# Design Document

## System Architecture

### Overview

The AI-powered In-App Help Chat system integrates seamlessly with the existing PPM platform architecture, leveraging the current FastAPI backend, Next.js frontend, and established RAG infrastructure. The system provides contextual assistance through a right-sidebar chat interface that maintains strict domain boundaries while delivering intelligent, multi-language support.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   AppLayout     │  │   HelpChat      │  │  HelpProvider   │ │
│  │   Component     │  │   Component     │  │   Context       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
├─────────────────────────────────┼─────────────────────────────────┤
│                    API Layer    │                               │
├─────────────────────────────────┼─────────────────────────────────┤
│                    Backend (FastAPI)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Help Router    │  │  Context Agent  │  │  Scope Guard    │ │
│  │  /ai/help       │  │  Enhanced RAG   │  │  Validator      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
├─────────────────────────────────┼─────────────────────────────────┤
│              AI Services        │                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   OpenAI API    │  │  LangChain RAG  │  │   Translation   │ │
│  │   GPT-4         │  │   Pipeline      │  │   Service       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                 │                               │
├─────────────────────────────────┼─────────────────────────────────┤
│              Data Layer         │                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Supabase      │  │   Vector Store  │  │   Help Content  │ │
│  │   Database      │  │   Embeddings    │  │   Knowledge     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### Frontend Components

#### 1. HelpChatProvider Context

**Location**: `app/providers/HelpChatProvider.tsx`

**Purpose**: Manages global help chat state, user preferences, and session management.

**State Management**:
```typescript
interface HelpChatState {
  isOpen: boolean
  messages: ChatMessage[]
  isLoading: boolean
  currentContext: PageContext
  userPreferences: UserPreferences
  sessionId: string
  proactiveTipsEnabled: boolean
  language: 'en' | 'de' | 'fr'
}

interface PageContext {
  route: string
  pageTitle: string
  userRole: string
  currentProject?: string
  currentPortfolio?: string
  relevantData?: Record<string, any>
}

interface UserPreferences {
  language: 'en' | 'de' | 'fr'
  proactiveTips: boolean
  chatPosition: 'right' | 'left'
  soundEnabled: boolean
  tipFrequency: 'high' | 'medium' | 'low' | 'off'
}
```

#### 2. HelpChat Component

**Location**: `components/HelpChat.tsx`

**Purpose**: Main chat interface with responsive design and accessibility features.

**Key Features**:
- Collapsible right sidebar (desktop) / slide-in overlay (mobile)
- Message history with source attribution
- Typing indicators and loading states
- Quick action buttons for common queries
- Screenshot/guide integration
- Feedback collection interface

**Component Structure**:
```typescript
interface HelpChatProps {
  isOpen: boolean
  onToggle: () => void
  isMobile: boolean
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tip'
  content: string
  timestamp: Date
  sources?: SourceReference[]
  confidence?: number
  actions?: QuickAction[]
  attachments?: Attachment[]
}

interface QuickAction {
  id: string
  label: string
  action: () => void
  icon?: string
}
```

#### 3. HelpChatToggle Component

**Location**: `components/HelpChatToggle.tsx`

**Purpose**: Floating toggle button with notification indicators.

**Features**:
- Responsive positioning (desktop: fixed right, mobile: header integration)
- Notification badges for new tips
- Accessibility compliance (ARIA labels, keyboard navigation)
- Animation states for attention-grabbing

#### 4. ProactiveTips Component

**Location**: `components/ProactiveTips.tsx`

**Purpose**: Context-aware tip generation and display system.

**Tip Types**:
- Welcome tours for new users
- Feature discovery based on usage patterns
- Performance optimization suggestions
- Best practice recommendations
- Workflow efficiency tips

### Backend Services

#### 1. Help Chat Router

**Location**: `backend/routers/help_chat.py`

**Endpoints**:
```python
@router.post("/ai/help/query")
async def process_help_query(
    query: HelpQueryRequest,
    current_user = Depends(get_current_user)
) -> HelpQueryResponse

@router.get("/ai/help/context")
async def get_help_context(
    page_route: str,
    current_user = Depends(get_current_user)
) -> HelpContextResponse

@router.post("/ai/help/feedback")
async def submit_help_feedback(
    feedback: HelpFeedbackRequest,
    current_user = Depends(get_current_user)
) -> FeedbackResponse

@router.get("/ai/help/tips")
async def get_proactive_tips(
    context: str,
    current_user = Depends(get_current_user)
) -> ProactiveTipsResponse
```

#### 2. Enhanced RAG Agent for Help

**Location**: `backend/services/help_rag_agent.py`

**Purpose**: Specialized RAG agent with PPM domain focus and scope validation.

**Key Methods**:
```python
class HelpRAGAgent(RAGReporterAgent):
    async def process_help_query(
        self, 
        query: str, 
        context: PageContext, 
        user_id: str,
        language: str = 'en'
    ) -> HelpResponse
    
    async def validate_scope(self, query: str, response: str) -> ScopeValidation
    
    async def generate_proactive_tips(
        self, 
        context: PageContext, 
        user_behavior: UserBehavior
    ) -> List[ProactiveTip]
    
    async def translate_response(
        self, 
        content: str, 
        target_language: str
    ) -> TranslatedContent
```

#### 3. Context Analyzer Service

**Location**: `backend/services/context_analyzer.py`

**Purpose**: Analyzes user context to provide relevant help and tips.

**Context Sources**:
- Current page/route
- User role and permissions
- Recent user actions
- Project/portfolio data
- Performance metrics
- Error patterns

#### 4. Scope Validation Service

**Location**: `backend/services/scope_validator.py`

**Purpose**: Ensures responses stay within PPM domain boundaries.

**Validation Rules**:
- PPM feature focus only
- No external tool recommendations
- No Cora methodology references
- No general business advice
- Platform-specific guidance only

## Data Models

### Database Schema Extensions

#### Help Sessions Table
```sql
CREATE TABLE help_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    session_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    page_context JSONB,
    language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Help Messages Table
```sql
CREATE TABLE help_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES help_sessions(id),
    message_type VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system', 'tip'
    content TEXT NOT NULL,
    sources JSONB,
    confidence_score DECIMAL(3,2),
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Help Feedback Table
```sql
CREATE TABLE help_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES help_messages(id),
    user_id UUID REFERENCES auth.users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(50), -- 'helpful', 'not_helpful', 'incorrect', 'suggestion'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Help Analytics Table
```sql
CREATE TABLE help_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type VARCHAR(50) NOT NULL, -- 'query', 'tip_shown', 'tip_dismissed', 'feedback'
    event_data JSONB,
    page_context JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Help Content Knowledge Base
```sql
CREATE TABLE help_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL, -- 'guide', 'faq', 'feature_doc', 'troubleshooting'
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[],
    language VARCHAR(5) DEFAULT 'en',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Request/Response Models

#### Help Query Request
```typescript
interface HelpQueryRequest {
  query: string
  sessionId?: string
  context: {
    route: string
    pageTitle: string
    userRole: string
    currentProject?: string
    currentPortfolio?: string
    relevantData?: Record<string, any>
  }
  language: 'en' | 'de' | 'fr'
  includeProactiveTips?: boolean
}
```

#### Help Query Response
```typescript
interface HelpQueryResponse {
  response: string
  sessionId: string
  sources: SourceReference[]
  confidence: number
  responseTimeMs: number
  proactiveTips?: ProactiveTip[]
  suggestedActions?: QuickAction[]
  relatedGuides?: GuideReference[]
}
```

#### Proactive Tip Model
```typescript
interface ProactiveTip {
  id: string
  type: 'welcome' | 'feature_discovery' | 'optimization' | 'best_practice'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  triggerContext: string[]
  actions?: QuickAction[]
  dismissible: boolean
  showOnce: boolean
}
```

## Integration Points

### 1. Existing RAG System Integration

**Current RAG Agent Enhancement**:
- Extend `RAGReporterAgent` class for help-specific functionality
- Reuse existing vector embeddings and search infrastructure
- Leverage current OpenAI integration and prompt management
- Maintain existing performance monitoring and logging

**Vector Store Integration**:
- Utilize existing Supabase vector storage
- Add help-specific content embeddings
- Implement content versioning for help documentation
- Enable multi-language embedding support

### 2. Authentication & Authorization

**User Context Integration**:
- Leverage existing `get_current_user` dependency
- Respect existing RBAC permissions
- Maintain session consistency across help interactions
- Anonymous analytics with user privacy protection

### 3. Frontend Layout Integration

**AppLayout Component Enhancement**:
```typescript
// Enhanced AppLayout with help chat integration
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <HelpChatProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={!isMobile} />
        
        <div className="flex-1 flex flex-col min-w-0">
          {isMobile && <MobileHeader />}
          
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        
        {/* Help Chat Integration */}
        <HelpChat />
        <HelpChatToggle />
      </div>
    </HelpChatProvider>
  )
}
```

### 4. API Router Integration

**Existing AI Router Extension**:
- Add help-specific endpoints to `backend/routers/ai.py`
- Maintain consistency with existing AI agent patterns
- Reuse authentication and error handling middleware
- Integrate with existing performance monitoring

## UI/UX Design Specifications

### Desktop Interface

#### Right Sidebar Design
- **Width**: 400px (collapsible to 0px)
- **Position**: Fixed right, full height
- **Background**: White with subtle shadow
- **Border**: Left border with theme color
- **Animation**: Smooth slide transition (300ms ease-in-out)

#### Chat Interface Elements
- **Header**: Help chat title with minimize/close buttons
- **Message Area**: Scrollable with auto-scroll to bottom
- **Input Area**: Multi-line text input with send button
- **Quick Actions**: Contextual suggestion buttons
- **Feedback**: Thumbs up/down with optional text feedback

### Mobile Interface

#### Slide-in Overlay Design
- **Coverage**: Full screen overlay with backdrop
- **Animation**: Slide from right (iOS style)
- **Header**: Title with close button and back gesture support
- **Responsive**: Optimized for touch interaction
- **Accessibility**: Screen reader compatible

#### Mobile-Specific Features
- **Hamburger Integration**: Help icon in mobile header
- **Touch Gestures**: Swipe to close, pull to refresh
- **Keyboard Handling**: Auto-resize for virtual keyboard
- **Offline Support**: Cached responses and graceful degradation

### Accessibility Features

#### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and roles
- **Color Contrast**: Minimum 4.5:1 contrast ratio
- **Focus Management**: Clear focus indicators
- **Alternative Text**: All images and icons have alt text

#### Internationalization
- **RTL Support**: Right-to-left language compatibility
- **Font Scaling**: Responsive to user font size preferences
- **Cultural Adaptation**: Date/time formats per locale
- **Translation Quality**: Professional translation validation

## Performance Considerations

### Frontend Optimization

#### Code Splitting
```typescript
// Lazy load help chat components
const HelpChat = lazy(() => import('../components/HelpChat'))
const ProactiveTips = lazy(() => import('../components/ProactiveTips'))

// Preload on user interaction
const preloadHelpChat = () => {
  import('../components/HelpChat')
}
```

#### State Management
- **Context Optimization**: Minimize re-renders with useMemo/useCallback
- **Message Virtualization**: Virtual scrolling for long chat histories
- **Debounced Typing**: Reduce API calls during typing
- **Offline Caching**: Cache responses for offline access

### Backend Optimization

#### Caching Strategy
```python
# Multi-level caching for help responses
@cache_manager.cached(ttl=3600, key_prefix="help_content")
async def get_help_content(content_type: str, language: str):
    pass

@cache_manager.cached(ttl=300, key_prefix="help_context")
async def get_page_context(route: str, user_id: str):
    pass
```

#### Response Optimization
- **Streaming Responses**: Real-time response streaming for long answers
- **Compression**: Gzip compression for API responses
- **Connection Pooling**: Efficient database connection management
- **Rate Limiting**: Prevent abuse while maintaining responsiveness

### Monitoring & Analytics

#### Performance Metrics
- **Response Time**: Track help query response times
- **User Engagement**: Measure chat usage patterns
- **Satisfaction Scores**: Monitor feedback ratings
- **Error Rates**: Track and alert on system errors

#### Privacy-Compliant Analytics
```python
# Anonymous analytics tracking
async def track_help_event(
    event_type: str,
    context: dict,
    user_hash: str  # Anonymized user identifier
):
    analytics_data = {
        "event_type": event_type,
        "context": sanitize_context(context),
        "user_hash": user_hash,
        "timestamp": datetime.now()
    }
    await store_anonymous_analytics(analytics_data)
```

## Security & Privacy

### Data Protection

#### Privacy by Design
- **No Personal Data Storage**: Only anonymous usage patterns
- **Session Isolation**: Each session is independent
- **Data Minimization**: Collect only necessary information
- **Automatic Cleanup**: Regular purging of old session data

#### Security Measures
- **Input Sanitization**: Prevent XSS and injection attacks
- **Rate Limiting**: Protect against abuse and DoS
- **Authentication**: Secure user context validation
- **Audit Logging**: Track system access and changes

### Compliance

#### GDPR Compliance
- **Right to Erasure**: Ability to delete user help data
- **Data Portability**: Export user help interactions
- **Consent Management**: Clear opt-in/opt-out mechanisms
- **Privacy Notice**: Transparent data usage disclosure

#### Content Security
- **Scope Validation**: Strict domain boundary enforcement
- **Content Filtering**: Prevent inappropriate responses
- **Source Attribution**: Clear citation of information sources
- **Quality Assurance**: Regular content accuracy reviews

## Deployment Strategy

### Environment Configuration

#### Development Environment
```bash
# Environment variables for help chat
HELP_CHAT_ENABLED=true
HELP_CHAT_DEBUG=true
OPENAI_API_KEY=sk-...
HELP_CONTENT_VERSION=dev
PROACTIVE_TIPS_ENABLED=true
```

#### Production Environment
```bash
# Production configuration
HELP_CHAT_ENABLED=true
HELP_CHAT_DEBUG=false
HELP_CHAT_RATE_LIMIT=100
HELP_ANALYTICS_ENABLED=true
HELP_CONTENT_CDN=https://cdn.example.com/help
```

### Feature Flags

#### Gradual Rollout Strategy
```typescript
// Feature flag configuration
const helpChatFeatureFlags = {
  enabled: process.env.HELP_CHAT_ENABLED === 'true',
  proactiveTips: process.env.PROACTIVE_TIPS_ENABLED === 'true',
  multiLanguage: process.env.MULTI_LANGUAGE_SUPPORT === 'true',
  analytics: process.env.HELP_ANALYTICS_ENABLED === 'true',
  betaFeatures: process.env.HELP_BETA_FEATURES === 'true'
}
```

### Monitoring & Alerting

#### Health Checks
- **API Endpoint Health**: Monitor help chat API availability
- **Response Quality**: Track confidence scores and user feedback
- **Performance Metrics**: Monitor response times and error rates
- **Usage Analytics**: Track adoption and engagement metrics

#### Alert Configuration
```yaml
# Alert thresholds
help_chat_alerts:
  response_time_p95: 2000ms
  error_rate_threshold: 5%
  low_confidence_threshold: 60%
  user_satisfaction_threshold: 3.5/5
```

This comprehensive design document provides the technical foundation for implementing the AI-powered In-App Help Chat system while maintaining consistency with the existing PPM platform architecture and ensuring superior user experience across all devices and languages.