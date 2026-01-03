# Project Structure & Organization

## Repository Layout

```
ai-ppm-platform/
├── frontend/                 # Next.js React application
├── backend/                  # FastAPI Python application
├── .kiro/                   # Kiro configuration and specs
├── .vercel/                 # Vercel deployment config
└── [root config files]      # Git, environment, etc.
```

## Frontend Structure (`frontend/`)

### App Router Architecture (Next.js 13+)
```
frontend/
├── app/                     # App Router pages and layouts
│   ├── layout.tsx          # Root layout with auth provider
│   ├── page.tsx            # Home/landing page
│   ├── globals.css         # Global styles and Tailwind
│   ├── dashboards/         # Portfolio dashboard pages
│   ├── reports/            # RAG reporting interface
│   ├── resources/          # Resource management pages
│   └── providers/          # React context providers
│       └── SupabaseAuthProvider.tsx
├── components/             # Reusable UI components
│   ├── AppLayout.tsx       # Main app layout with sidebar
│   └── Sidebar.tsx         # Navigation sidebar
├── lib/                    # Utility libraries
│   └── supabase.ts         # Supabase client configuration
├── public/                 # Static assets (SVGs, images)
├── [config files]          # Next.js, TypeScript, Tailwind configs
└── package.json            # Dependencies and scripts
```

### Key Frontend Patterns
- **App Router**: File-based routing with layouts
- **Server Components**: Default for better performance
- **Client Components**: Marked with 'use client' for interactivity
- **Provider Pattern**: Authentication and state management
- **Component Composition**: Reusable UI building blocks

## Backend Structure (`backend/`)

### FastAPI Application
```
backend/
├── main.py                 # FastAPI app with all endpoints
├── migrations/             # Database schema management
│   ├── README.md          # Migration documentation
│   ├── MIGRATION_SUMMARY.md
│   ├── supabase_schema_enhancement.sql
│   ├── verify_schema.py   # Schema verification script
│   └── [other migration files]
├── tests/                  # Test suite
│   └── test_projects.py   # API endpoint tests
├── venv/                   # Python virtual environment
├── .env                    # Environment variables
└── [test/config files]     # Coverage, pytest configs
```

### API Organization in main.py
- **Authentication**: JWT-based auth with Supabase
- **CRUD Endpoints**: Projects, resources, portfolios
- **AI Endpoints**: RAG queries, resource optimization
- **Utility Functions**: Data conversion, context gathering
- **Error Handling**: Comprehensive exception management

## Configuration & Specs (`.kiro/`)

### Kiro-Specific Structure
```
.kiro/
├── specs/                  # Feature specifications
│   └── ai-ppm-platform/
│       ├── requirements.md # Detailed requirements
│       ├── design.md      # Architecture and design
│       └── tasks.md       # Implementation tasks
└── steering/              # AI assistant guidance
    ├── product.md         # Product overview
    ├── tech.md           # Technology stack
    └── structure.md      # This file
```

## Database Schema Organization

### Core Entities
- **portfolios**: Top-level project groupings
- **projects**: Individual projects with health tracking
- **resources**: Team members with skills and availability
- **risks**: Risk register with probability/impact scoring
- **issues**: Issue tracking linked to risks

### Supporting Tables
- **workflows**: Configurable approval processes
- **financial_tracking**: Multi-currency budget management
- **milestones**: Project milestone tracking
- **audit_logs**: Change tracking and compliance

### Relationships
- Portfolio → Projects (one-to-many)
- Projects → Resources (many-to-many via project_resources)
- Risks → Issues (one-to-many when risks materialize)
- Projects → Milestones (one-to-many)

## Development Patterns

### Frontend Conventions
- **File Naming**: PascalCase for components, camelCase for utilities
- **Component Structure**: Props interface, main component, export
- **State Management**: React hooks + Supabase real-time subscriptions
- **Styling**: Tailwind utility classes with consistent spacing
- **Type Safety**: TypeScript interfaces matching backend models

### Backend Conventions
- **Endpoint Naming**: RESTful conventions with clear resource paths
- **Data Models**: Pydantic models for request/response validation
- **Error Handling**: HTTP status codes with descriptive messages
- **Authentication**: Dependency injection for user context
- **Database**: Supabase client with RLS policy enforcement

### AI Integration Patterns
- **Agent Architecture**: Specialized agents for different domains
- **RAG Implementation**: Context gathering → AI processing → validation
- **Prompt Engineering**: Structured prompts with clear instructions
- **Response Validation**: Hallucination detection and fact-checking

## File Naming Conventions

### Frontend
- **Pages**: `page.tsx` (App Router convention)
- **Layouts**: `layout.tsx` (App Router convention)
- **Components**: `ComponentName.tsx` (PascalCase)
- **Utilities**: `utilityName.ts` (camelCase)
- **Types**: `types.ts` or inline interfaces

### Backend
- **Main App**: `main.py` (FastAPI convention)
- **Models**: Inline Pydantic classes in main.py
- **Tests**: `test_*.py` (pytest convention)
- **Migrations**: `*.sql` and `*.py` scripts
- **Utilities**: `snake_case.py` (Python convention)

## Import/Export Patterns

### Frontend Imports
```typescript
// External libraries first
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Internal components/utilities
import AppLayout from '@/components/AppLayout'
import { supabase } from '@/lib/supabase'
```

### Backend Imports
```python
# Standard library first
import os
from typing import List, Dict, Any

# Third-party libraries
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Local imports
from .models import ProjectCreate
```

## Deployment Structure

### Frontend (Vercel)
- **Build Output**: `.next/` directory
- **Static Assets**: Served from CDN
- **Environment**: Production variables in Vercel dashboard
- **Domains**: Custom domain with SSL

### Backend (Railway/AWS)
- **Container**: Docker image with FastAPI app
- **Environment**: Secure environment variable injection
- **Health Checks**: `/` endpoint for monitoring
- **Scaling**: Horizontal scaling based on load

This structure supports rapid development while maintaining clear separation of concerns and scalability for the AI-powered PPM platform.