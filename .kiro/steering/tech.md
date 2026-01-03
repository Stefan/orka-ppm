# Technology Stack & Build System

## Architecture Overview

Full-stack TypeScript/Python application with microservices architecture, AI agents, and modern deployment pipeline.

## Frontend Stack

### Core Technologies
- **Next.js 16.1.1** - React framework with App Router
- **React 19.2.3** - UI library with latest features
- **TypeScript 5** - Type safety and developer experience
- **Tailwind CSS 4** - Utility-first styling with animations
- **Lucide React** - Icon library for consistent UI

### Key Libraries
- **@supabase/supabase-js** - Database client and authentication
- **Recharts** - Data visualization and charting
- **React Query** (implied) - State management and caching

### Development Tools
- **ESLint 9** - Code linting with Next.js config
- **PostCSS** - CSS processing pipeline

## Backend Stack

### Core Technologies
- **FastAPI** - Modern Python web framework for APIs
- **Python 3.11+** - Runtime environment
- **Supabase** - Backend-as-a-Service (database, auth, real-time)
- **PostgreSQL** - Primary database via Supabase

### AI/ML Stack
- **OpenAI GPT-4** - Natural language processing and generation
- **LangChain** (implied) - RAG implementation and agent orchestration
- **Vector Database** - Embeddings storage for RAG functionality

### Key Libraries
- **Pydantic** - Data validation and serialization
- **JWT** - Token-based authentication
- **python-dotenv** - Environment variable management
- **Supabase Python Client** - Database operations

## Database & Infrastructure

### Database
- **PostgreSQL** (via Supabase) - Primary data storage
- **Row Level Security (RLS)** - Data access control
- **Real-time subscriptions** - Live data updates
- **Vector embeddings** - AI/RAG functionality

### Deployment
- **Vercel** - Frontend hosting and deployment
- **Supabase** - Managed backend services
- **Railway/AWS** (planned) - Backend API hosting

## Common Commands

### Frontend Development
```bash
cd frontend

# Development
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint

# Dependencies
npm install          # Install dependencies
npm install <package> # Add new package
```

### Backend Development
```bash
cd backend

# Environment setup
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt

# Development
python main.py       # Start FastAPI server (localhost:8000)
uvicorn main:app --reload  # Alternative with auto-reload

# Database migrations
python migrations/verify_schema.py    # Verify database schema
python migrations/apply_migration.py  # Apply migrations

# Testing
python -m pytest tests/              # Run test suite
python -m pytest --cov=.            # Run with coverage
```

### Full Stack Development
```bash
# Start both services (run in separate terminals)
cd frontend && npm run dev
cd backend && uvicorn main:app --reload

# Or use process managers like concurrently
npx concurrently "cd frontend && npm run dev" "cd backend && uvicorn main:app --reload"
```

## Environment Configuration

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Backend (.env)
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_key
```

## Build & Deployment

### Frontend Deployment (Vercel)
- Automatic deployment on git push
- Environment variables configured in Vercel dashboard
- Build command: `npm run build`
- Output directory: `.next`

### Backend Deployment
- FastAPI application ready for containerization
- Docker support recommended for production
- Environment variables required for all services
- Health check endpoint available at `/`

## Development Workflow

1. **Database First**: Apply migrations before code changes
2. **Type Safety**: Use TypeScript interfaces matching Pydantic models
3. **API Documentation**: FastAPI auto-generates OpenAPI docs at `/docs`
4. **Real-time Updates**: Leverage Supabase subscriptions for live data
5. **AI Integration**: Use structured prompts and validation for AI features

## Performance Considerations

- **Frontend**: Next.js App Router for optimal loading
- **Backend**: FastAPI async/await for concurrent requests
- **Database**: Proper indexing and RLS policies
- **Caching**: Redis recommended for production AI agent responses
- **CDN**: Vercel Edge Network for global distribution