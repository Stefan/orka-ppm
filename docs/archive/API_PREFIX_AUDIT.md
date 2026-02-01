# API Prefix Audit - Frontend vs Backend

## 🔍 Analyse aller API-Endpoints

### Backend Router Prefixes:

| Router | Prefix | Korrekt? |
|--------|--------|----------|
| admin.py | `/api/admin` | ✅ Hat /api |
| rbac.py | `/api/rbac` | ✅ Hat /api |
| audit.py | `/api/audit` | ✅ Hat /api |
| enhanced_pmr.py | `/api/reports/pmr` | ✅ Hat /api |
| pmr_performance.py | `/api/reports/pmr/performance` | ✅ Hat /api |
| projects_import.py | `/api/projects` | ✅ Hat /api |
| simulations.py | `/api/v1/monte-carlo` | ✅ Hat /api |
| shareable_urls.py | `/api` | ✅ Hat /api |
| **feature_flags.py** | `/admin/feature-flags` | ⚠️ KEIN /api |
| **admin_performance.py** | `/admin/performance` | ⚠️ KEIN /api |
| **users.py** | `/admin/users` | ⚠️ KEIN /api |
| portfolios.py | `/portfolios` | ✅ Kein /api (konsistent) |
| projects.py | `/projects` | ✅ Kein /api (konsistent) |
| resources.py | `/resources` | ✅ Kein /api (konsistent) |
| risks.py | `/risks` | ✅ Kein /api (konsistent) |
| scenarios.py | `/simulations/what-if` | ✅ Kein /api (konsistent) |
| feedback.py | `/feedback` | ✅ Kein /api (konsistent) |
| ai.py | `/ai` | ✅ Kein /api (konsistent) |
| help_chat.py | `/ai/help` | ✅ Kein /api (konsistent) |
| variance.py | `/variance` | ✅ Kein /api (konsistent) |
| csv_import.py | `/csv-import` | ✅ Kein /api (konsistent) |
| reports.py | `/reports` | ✅ Kein /api (konsistent) |
| workflows.py | `/workflows` | ✅ Kein /api (konsistent) |

---

## ⚠️ INKONSISTENZEN GEFUNDEN!

### Problem 1: Gemischte Prefixes für Admin-Routers

**Backend hat 3 verschiedene Admin-Router:**

1. `admin.py` → `/api/admin/*` ✅
2. `admin_performance.py` → `/admin/performance/*` ❌
3. `users.py` → `/admin/users/*` ❌
4. `feature_flags.py` → `/admin/feature-flags/*` ❌

**Das ist inkonsistent!**

---

## 🔧 Zu fixende Frontend-Calls

### 1. Admin Performance (bereits gefixt ✅)

**Datei**: `app/admin/performance/page.tsx`

- ✅ `/api/admin/performance/stats` (gefixt)
- ✅ `/api/admin/performance/health` (gefixt)
- ✅ `/api/admin/cache/stats` (gefixt)
- ✅ `/api/admin/cache/clear` (gefixt)

**ABER**: Backend hat `/admin/performance/*` (ohne /api)!

### 2. Admin Users (bereits gefixt ✅)

**Datei**: `app/admin/users/page.tsx`

- ✅ `/api/admin/users` (gefixt)
- ✅ `/api/admin/roles` (gefixt)

**ABER**: Backend hat `/admin/users/*` (ohne /api)!

### 3. Admin Setup Help

**Datei**: `components/admin/SetupHelp.tsx`

```typescript
const response = await fetch(getApiUrl('/admin/help/setup'), {
```

**Status**: ❌ Muss geprüft werden - gibt es diesen Endpoint?

### 4. Feature Flags (nicht im Frontend gefunden)

**Backend**: `/admin/feature-flags/*`  
**Frontend**: Keine Calls gefunden

---

## 🎯 EMPFEHLUNG: Backend-Routers vereinheitlichen

### Option A: Alle Admin-Router unter `/api/admin`

**Ändern**:
- `admin_performance.py`: `/admin/performance` → `/api/admin/performance`
- `users.py`: `/admin/users` → `/api/admin/users`
- `feature_flags.py`: `/admin/feature-flags` → `/api/admin/feature-flags`

**Vorteil**: Konsistent mit `admin.py`  
**Nachteil**: Backend-Änderung nötig

### Option B: Frontend zurück zu `/admin/*` (ohne /api)

**Ändern**:
- `app/admin/performance/page.tsx`: `/api/admin/*` → `/admin/*`
- `app/admin/users/page.tsx`: `/api/admin/*` → `/admin/*`

**Vorteil**: Passt zu bestehenden Backend-Routers  
**Nachteil**: Inkonsistent mit `admin.py` Router

---

## 🔍 Weitere potenzielle Probleme

### 1. Monte Carlo Endpoints

**Backend**: `/api/v1/monte-carlo/*`  
**Frontend**: `/monte-carlo/*`

**Dateien**:
- `components/MonteCarloVisualization.tsx`: `/monte-carlo/simulations/...`
- `app/monte-carlo/page.tsx`: `/monte-carlo/simulations/run`

**Status**: ❌ FALSCH! Muss `/api/v1/monte-carlo/*` sein

### 2. PMR Reports

**Backend**: `/api/reports/pmr/*`  
**Frontend**: `/reports/pmr/*`

**Dateien**:
- `components/pmr/MonteCarloAnalysisComponent.example.tsx`: `/reports/pmr/...`
- `app/reports/page.tsx`: `/reports/pmr/chat`

**Status**: ❌ FALSCH! Muss `/api/reports/pmr/*` sein

### 3. CSV Import

**Backend**: `/csv-import/*`  
**Frontend**: `/csv-import/*` und `/api/csv-import`

**Dateien**:
- `app/projects/components/ImportForm.tsx`: `/api/csv-import` ❌
- `app/financials/components/views/CSVImportView.tsx`: `/csv-import/*` ✅

**Status**: ⚠️ GEMISCHT! ImportForm nutzt `/api/csv-import` (falsch)

### 4. Audit Endpoints

**Backend**: `/api/audit/*`  
**Frontend**: `/audit/*`

**Dateien**:
- `app/audit/page.tsx`: `/audit/dashboard/stats`, `/audit/logs`, etc.

**Status**: ❌ FALSCH! Muss `/api/audit/*` sein

---

## 📊 Zusammenfassung

### Definitiv falsch (müssen gefixt werden):

1. ❌ **Monte Carlo**: `/monte-carlo/*` → `/api/v1/monte-carlo/*`
2. ❌ **PMR Reports**: `/reports/pmr/*` → `/api/reports/pmr/*`
3. ❌ **Audit**: `/audit/*` → `/api/audit/*`
4. ❌ **CSV Import (teilweise)**: `/api/csv-import` → `/csv-import`

### Unklar (Backend-Inkonsistenz):

5. ⚠️ **Admin Performance**: Frontend nutzt `/api/admin/*`, Backend hat `/admin/*`
6. ⚠️ **Admin Users**: Frontend nutzt `/api/admin/*`, Backend hat `/admin/*`

### Korrekt:

- ✅ Portfolios, Projects, Resources, Risks, Scenarios
- ✅ Feedback, AI, Help Chat, Variance
- ✅ Workflows, Financial Tracking

---

## 🚀 Nächste Schritte

### Sofort fixen (Frontend):

1. Monte Carlo Endpoints
2. PMR Reports Endpoints
3. Audit Endpoints
4. CSV Import (ImportForm)

### Dann entscheiden:

- Admin-Routers: Backend ändern ODER Frontend zurückändern?

---

**Erstellt**: 22. Januar 2026, 19:00 Uhr  
**Status**: Audit abgeschlossen, Fixes ausstehend

