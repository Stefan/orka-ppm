# ORKA-PPM Projektstruktur

## 📁 Überblick der Verzeichnisstruktur

```
orka-ppm/
├── 📁 app/                          # Next.js App Router (Frontend)
│   ├── 📁 admin/                    # Admin-Bereich
│   │   ├── performance/             # Performance-Monitoring
│   │   └── users/                   # Benutzerverwaltung
│   ├── 📁 changes/                  # Change Management
│   ├── 📁 dashboards/               # Portfolio Dashboards
│   ├── 📁 feedback/                 # Feedback & Ideas
│   ├── 📁 financials/               # Financial Tracking
│   ├── 📁 providers/                # React Context Provider
│   ├── 📁 reports/                  # AI Reports & Analytics
│   ├── 📁 resources/                # Resource Management
│   ├── 📁 risks/                    # Risk/Issue Registers
│   ├── 📁 scenarios/                # What-If Scenarios
│   ├── globals.css                  # Globale Styles
│   ├── layout.tsx                   # Root Layout
│   └── page.tsx                     # Homepage
│
├── 📁 backend/                      # FastAPI Backend
│   ├── 📁 auth/                     # Authentifizierung & RBAC
│   ├── 📁 config/                   # Konfiguration & Settings
│   ├── 📁 docs/                     # Backend-Dokumentation
│   ├── 📁 migrations/               # Datenbank-Migrationen
│   ├── 📁 models/                   # Pydantic Models
│   ├── 📁 pre_startup_testing/      # Pre-Startup Tests
│   ├── 📁 routers/                  # API Endpoints
│   ├── 📁 scripts/                  # Utility Scripts
│   ├── 📁 services/                 # Business Logic Services
│   ├── 📁 tests/                    # Test Suite
│   ├── 📁 utils/                    # Utility Functions
│   ├── main.py                      # FastAPI App Entry Point
│   └── requirements.txt             # Python Dependencies
│
├── 📁 components/                   # React Components
│   ├── 📁 admin/                    # Admin-spezifische Components
│   ├── 📁 ui/                       # Basis UI Components
│   │   ├── Button.tsx               # Button Component
│   │   ├── Card.tsx                 # Card Component
│   │   ├── Input.tsx                # Input Components
│   │   ├── Modal.tsx                # Modal Component
│   │   ├── Select.tsx               # Select Component
│   │   └── index.ts                 # Component Exports
│   ├── AppLayout.tsx                # App Layout Component
│   ├── ErrorBoundary.tsx            # Error Boundary
│   ├── LoadingSpinner.tsx           # Loading Components
│   ├── Sidebar.tsx                  # Navigation Sidebar
│   └── Toast.tsx                    # Toast Notifications
│
├── 📁 docs/                         # Projektdokumentation
│   ├── 📁 backend/                  # Backend-Dokumentation
│   ├── 📁 deployment/               # Deployment-Guides
│   ├── 📁 frontend/                 # Frontend-Dokumentation
│   ├── ADMIN_SETUP.md               # Admin Setup Guide
│   ├── CI_CD_INTEGRATION.md         # CI/CD Integration
│   ├── DEPLOYMENT_PROCEDURES.md     # Deployment Procedures
│   ├── PROJECT_STRUCTURE.md         # Diese Datei
│   ├── SECURITY_CHECKLIST.md        # Security Checklist
│   └── USER_SYNCHRONIZATION.md      # User Sync Guide
│
├── 📁 hooks/                        # Custom React Hooks
│   ├── useAsync.ts                  # Async Operations Hook
│   ├── useClickOutside.ts           # Click Outside Hook
│   ├── useDebounce.ts               # Debounce Hook
│   ├── useIntersectionObserver.ts   # Intersection Observer Hook
│   ├── useKeyboard.ts               # Keyboard Shortcuts Hook
│   ├── useLocalStorage.ts           # Local Storage Hook
│   ├── useMediaQuery.ts             # Media Query Hook
│   ├── usePrevious.ts               # Previous Value Hook
│   ├── useToggle.ts                 # Toggle State Hook
│   ├── useWindowSize.ts             # Window Size Hook
│   └── index.ts                     # Hook Exports
│
├── 📁 lib/                          # Utility Libraries
│   ├── api.ts                       # API Utilities
│   ├── design-system.ts             # Design System Tokens
│   ├── error-handler.ts             # Global Error Handling
│   └── performance.ts               # Performance Monitoring
│
├── 📁 public/                       # Static Assets
│   ├── favicon.ico                  # Favicon
│   ├── manifest.json                # PWA Manifest
│   └── ...                          # Weitere Assets
│
├── 📁 scripts/                      # Build & Development Scripts
│   ├── fix-critical-issues.js       # Issue Fix Script
│   ├── pre-commit-check.sh          # Pre-commit Hooks
│   ├── syntax-check.js              # Syntax Checker
│   └── test-input-readability.js    # Input Testing
│
├── 📁 types/                        # TypeScript Type Definitions
│   └── index.ts                     # Zentrale Type Definitions
│
├── 📁 .kiro/                        # Kiro Specs & Configuration
│   └── specs/                       # Feature Specifications
│
├── 📄 package.json                  # Node.js Dependencies
├── 📄 tsconfig.json                 # TypeScript Configuration
├── 📄 tailwind.config.ts            # Tailwind CSS Configuration
├── 📄 next.config.ts                # Next.js Configuration
├── 📄 .gitignore                    # Git Ignore Rules
└── 📄 README.md                     # Projekt README
```

## 🏗️ Architektur-Prinzipien

### Frontend (Next.js 14 + App Router)
- **App Router**: Moderne Next.js Routing mit Server Components
- **TypeScript**: Vollständige Type Safety
- **Tailwind CSS**: Utility-first CSS Framework
- **Design System**: Konsistente UI Components
- **Mobile-First**: Responsive Design für alle Geräte

### Backend (FastAPI + Supabase)
- **FastAPI**: Moderne Python API Framework
- **Supabase**: PostgreSQL Database + Auth
- **Pydantic**: Data Validation & Serialization
- **RBAC**: Role-Based Access Control
- **Modular Services**: Saubere Service-Architektur

### Entwicklungsstandards
- **TypeScript**: Strikte Type Checking
- **ESLint**: Code Quality & Consistency
- **Prettier**: Code Formatting
- **Property-Based Testing**: Comprehensive Testing
- **Error Boundaries**: Graceful Error Handling

## 📋 Verzeichnis-Konventionen

### Naming Conventions
- **Dateien**: kebab-case für Dateien (`user-management.ts`)
- **Komponenten**: PascalCase für React Components (`UserProfile.tsx`)
- **Hooks**: camelCase mit `use` Prefix (`useUserData.ts`)
- **Types**: PascalCase für Interfaces (`UserProfile`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Datei-Organisation
- **Komponenten**: Ein Component pro Datei
- **Hooks**: Ein Hook pro Datei
- **Services**: Logisch gruppierte Services
- **Types**: Zentrale Type Definitions
- **Tests**: Co-located mit Source Files

### Import-Struktur
```typescript
// 1. React & Next.js Imports
import React from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party Libraries
import { z } from 'zod'

// 3. Internal Components & Hooks
import { Button } from '@/components/ui'
import { useUserData } from '@/hooks'

// 4. Types & Utilities
import type { User } from '@/types'
import { cn } from '@/lib/design-system'
```

## 🔧 Entwicklungsworkflow

### Neue Features
1. **Spec Creation**: Feature Spec in `.kiro/specs/`
2. **Type Definition**: Types in `types/index.ts`
3. **Component Development**: UI Components in `components/`
4. **Hook Development**: Custom Hooks in `hooks/`
5. **Page Implementation**: Pages in `app/`
6. **Testing**: Tests co-located mit Source

### Code Quality
- **Pre-commit Hooks**: Automatische Code Quality Checks
- **TypeScript**: Strikte Type Checking
- **ESLint**: Code Linting
- **Property-Based Testing**: Comprehensive Testing
- **Error Handling**: Global Error Boundaries

## 📚 Weitere Dokumentation

- [Backend API Documentation](./backend/)
- [Frontend Component Guide](./frontend/)
- [Deployment Procedures](./DEPLOYMENT_PROCEDURES.md)
- [Security Checklist](./SECURITY_CHECKLIST.md)
- [Admin Setup Guide](./ADMIN_SETUP.md)