# Requirements: Topbar Unified Search

## Introduction

State-of-the-Art Suchfeld in der Topbar der PPM-SaaS-App: Hybrid Fulltext + Semantic Search, AI-Auto-Suggest, Result-Cards mit Previews/Links, Voice-Input und personalisierte Ergebnisse nach User-Rolle/Org. Baut auf bestehendem RAG/KB (Supabase pgvector, vector_chunks, knowledge_documents) und AI Help Chat auf.

## Glossary

- **Topbar_Search**: Suchfeld in der Topbar mit Placeholder, Search-Icon und Dropdown-Ergebnissen.
- **Fulltext_Search**: Keyword-Suche via Postgres pg_trgm (z. B. projects.name, commitments.po_number).
- **Semantic_Search**: RAG-basierte Suche über Vector-Index (KB, embeddings) für bedeutungsbasierte Treffer.
- **Auto_Suggest**: AI-Vorschläge beim Tippen (z. B. „cos“ → „Costbook“).
- **Result_Card**: Darstellung eines Treffers mit Title, Snippet, optional Thumbnail, Link.
- **Personalized_Results**: Filterung/Sortierung nach User-Rolle und Organisation.

---

## R-TB1: Topbar-Suche

**User Story:** Als User möchte ich zentral in der Topbar suchen, damit ich schnell Projekte, Features und Docs finde.

### Acceptance Criteria

1. THE Topbar SHALL contain a search input with Tailwind styling and placeholder „Suche Projekte, Features, Docs…“.
2. THE input SHALL show a Search icon (lucide-react).
3. WHEN the user types, results SHALL appear in a dropdown below the input (on input focus/type).
4. THE dropdown SHALL close on click outside or Escape.

---

## R-TB2: Fulltext

**User Story:** Als User möchte ich per Keyword schnell Projekte und PO-Nummern finden.

### Acceptance Criteria

1. THE system SHALL use Supabase/Postgres pg_trgm for fast keyword search.
2. Fulltext SHALL apply to at least `projects.name` and optionally `commitments.po_number` (or equivalent).
3. Trigram index and minimum length SHALL be considered for performance.

---

## R-TB3: Semantic

**User Story:** Als User möchte ich auch nach Bedeutung suchen (z. B. „Hilfe zu Variance“).

### Acceptance Criteria

1. THE system SHALL use the existing RAG vector index (KB + embeddings) for semantic search.
2. Results SHALL include KB articles and optionally a short AI summary.
3. Semantic results SHALL be combined with fulltext in a unified response.

---

## R-TB4: Auto-Suggest

**User Story:** Als User möchte ich beim Tippen sinnvolle Vorschläge erhalten.

### Acceptance Criteria

1. WHEN the user types (e.g. „cos“, „pro“), THE system SHALL return AI suggestions (e.g. „Costbook“, „Projekte“).
2. Suggestions SHALL use Grok/OpenAI or equivalent; max 10 suggestions.
3. Input SHALL be debounced (e.g. 300 ms) before triggering suggest/search.

---

## R-TB5: Results

**User Story:** Als User möchte ich Treffer als übersichtliche Cards mit Link sehen.

### Acceptance Criteria

1. Each result SHALL be displayed as a card with Title, Description-Snippet, and Link (e.g. `/financials/costbook`).
2. Cards MAY include an optional screenshot thumbnail (next/image, lazy).
3. Results SHALL be grouped by type (e.g. Projekte, Docs, Features) where applicable.
4. Clicking a card SHALL navigate to the result href.

---

## R-TB6: Voice

**User Story:** Als User möchte ich per Sprache suchen (hands-free).

### Acceptance Criteria

1. THE search input SHALL include a microphone button (lucide Mic) on the right.
2. WHEN the user activates the mic, THE system SHALL use the Web Speech API to capture speech (e.g. „Suche Costbook“).
3. THE transcript SHALL be set as the search query and search SHALL be triggered.
4. IF the Web Speech API is not available, the mic button SHALL be hidden or disabled.

---

## R-TB7: Personalisierung

**User Story:** Als Admin möchte ich Admin-relevante Ergebnisse sehen; als normaler User nur zugelassene Bereiche.

### Acceptance Criteria

1. Results SHALL be filtered/sorted by user role (e.g. Admin sees Admin features, User sees only allowed areas).
2. WHEN contextually relevant (e.g. „Suche Projekt X“), the user’s own projects SHALL be prioritized.
3. Role and optional organization SHALL be derived from the authenticated user (backend).

---

## R-TB8: Performance

**User Story:** Als User möchte ich flüssige Suche ohne Verzögerung.

### Acceptance Criteria

1. Search results SHALL be cached (e.g. react-query) where appropriate.
2. Input SHALL be debounced (300 ms) before sending requests.
3. THE system SHALL return at most 10 results per category or in total (configurable).
