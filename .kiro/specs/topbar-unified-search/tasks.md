# Tasks: Topbar Unified Search

## Overview

Implementierung in Reihenfolge: Spec-Dateien, DB-Migration (pg_trgm), Backend-Service, Backend-Router, Next.js-Proxy, Frontend TopbarSearch, Integration in TopBar.

---

## Task 1: Supabase/Postgres (pg_trgm + Fulltext-Index)

**Ziel:** Schnelle Keyword-Suche mit pg_trgm; Vector-Index für KB bleibt unverändert (bereits in Migration 025/026).

- [x] **1.1** pg_trgm Extension aktivieren (CREATE EXTENSION IF NOT EXISTS pg_trgm).
- [x] **1.2** GIN-Index auf `projects.name` für Trigram-Suche (z. B. USING gin(name gin_trgm_ops)).
- [x] **1.3** Optional: GIN-Index auf `commitments.po_number` (oder relevante Tabelle) falls vorhanden.
- [x] **1.4** Prüfen, dass Vector-Index für KB (vector_chunks/embeddings) aus Migration 025/026 für Semantic-Suche genutzt werden kann.

**Deliverable:** Migration `backend/migrations/050_search_fulltext.sql` (oder nächste freie Nummer).

---

## Task 2: Backend Endpoint (Unified Search)

**Ziel:** Ein Endpoint kombiniert Fulltext, Semantic und Auto-Suggest; Antwort personalisiert nach Rolle.

- [x] **2.1** Neuer Service `backend/services/unified_search_service.py`:
  - Fulltext: Supabase RPC oder Raw SQL mit pg_trgm (projects.name, ggf. commitments).
  - Semantic: Abfrage vector_chunks/embeddings oder Aufruf HelpRAGAgent/RAG-Interface.
  - Auto-Suggest: LLM-Call (Grok/OpenAI) für kurze Queries, max. 10 Vorschläge.
- [x] **2.2** Neuer Router `backend/routers/search.py`:
  - GET `/api/v1/search?q=...&limit=10`.
  - Depends: get_current_user.
  - Response-Schema: `{ fulltext: [], semantic: [], suggestions: [], meta: { role } }`.
- [x] **2.3** Personalisierung: Filter/Sortierung nach `role` und optional `organization_id` aus current_user.
- [x] **2.4** Router in `backend/main.py` registrieren.

**Deliverable:** search.py, unified_search_service.py, Eintrag in main.py.

---

## Task 3: Frontend Topbar-Search Component

**Ziel:** Suchfeld mit Debounce, Dropdown, Result-Cards, Keyboard.

- [x] **3.1** Neue Komponente `components/navigation/TopbarSearch.tsx`:
  - Kontrolliertes Input, Placeholder „Suche Projekte, Features, Docs…“, Search-Icon.
  - Debounce 300 ms; react-query (oder fetch) gegen Next.js `/api/search?q=...`.
- [x] **3.2** Results-Dropdown: Liste von Result-Cards (Title, Snippet, Link; optional Thumbnail).
  - Gruppierung nach Typ (fulltext vs. semantic) optional.
- [x] **3.3** Keyboard: Escape schließt Dropdown; Pfeiltasten zur Navigation optional.
- [x] **3.4** Klick außerhalb schließt Dropdown (useRef + mousedown listener).

**Deliverable:** TopbarSearch.tsx.

---

## Task 4: Voice-Integration

**Ziel:** Mikrofon-Button und Web Speech API.

- [x] **4.1** Mikrofon-Button (lucide Mic) rechts im Input-Container.
- [x] **4.2** Web Speech API: Start bei Klick, Transkript → setQuery + Suche auslösen.
- [x] **4.3** Fallback: Button ausblenden oder disabled, wenn SpeechRecognition nicht verfügbar.

**Deliverable:** Voice in TopbarSearch.tsx.

---

## Task 5: Personalisierung (Backend + Frontend)

**Ziel:** Ergebnisse nach User-Rolle/Org filtern und priorisieren.

- [x] **5.1** Backend: User-Rolle aus get_current_user; Filter für Admin vs. User (z. B. Admin-Features nur für Admin).
- [x] **5.2** Backend: Priorisierung „eigene“ Projekte (z. B. nach user_id oder org) wenn kontextrelevant.
- [x] **5.3** Frontend: Auth-Header mitschicken; optional role/org als Query-Param nur wenn Backend sie nicht aus Token ableitet.

**Deliverable:** Logik in unified_search_service.py und ggf. search.py; Frontend unverändert wenn Backend alles aus Token liest.

---

## Checkpoints

- **Nach Task 1:** Migration anwendbar; pg_trgm und GIN-Index aktiv.
- **Nach Task 2:** GET /api/v1/search mit Auth liefert fulltext/semantic/suggestions.
- **Nach Task 3:** TopbarSearch zeigt Dropdown mit Cards; Klick navigiert.
- **Nach Task 4:** Voice setzt Query und löst Suche aus.
- **Nach Task 5:** Admin sieht erweiterte Ergebnisse; User nur zugelassene.

---

## Test & Coverage (~80 %)

- **Backend:** `backend/tests/test_unified_search_service.py`, `backend/tests/test_search_router.py`
- **Frontend/API:** `__tests__/api-routes/search.route.test.ts`, `__tests__/components/navigation/TopbarSearch.test.tsx`

**Coverage ausführen:**

- Ein Skript für Backend + Frontend: `./scripts/coverage-topbar-search.sh` (aus Repo-Root). Backend nutzt `coverage` mit `backend/.coveragerc.topbar-search` (nur `unified_search_service` + `routers/search.py`).
- Nur Backend (aus `backend/`):  
  `python3 -m coverage run --rcfile=.coveragerc.topbar-search -m pytest tests/test_unified_search_service.py tests/test_search_router.py -v -o addopts="-v --tb=short"`  
  dann:  
  `python3 -m coverage report --rcfile=.coveragerc.topbar-search -m --include='*unified_search*','routers/search.py'`  
  Ziel: **≥80 %** für diese Module (aktuell Service ~81 %, Router 100 %).
- Frontend:  
  `npx jest __tests__/api-routes/search.route.test.ts __tests__/components/navigation/TopbarSearch.test.tsx --coverage --collectCoverageFrom='app/api/search/route.ts' --collectCoverageFrom='components/navigation/TopbarSearch.tsx' --coverageThreshold='{}'`
