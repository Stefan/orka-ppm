# Requirements: Features Overview Optimization

## Introduction

Structured optimization of the Features Overview page (Next.js 16 + Tailwind + Supabase). Goals: fix load time and workflow issues; 10x better UX via AI search (RAG from KB), hover previews, auto-expand on search, inline-edit modal, and virtualized tree. Builds on existing layout: tree left, detail right.

## Glossary

- **Features_Overview**: Page at `/features` with tree (pages/features) and detail card.
- **RAG_Search**: Retrieval-Augmented Generation over knowledge base / feature catalog for contextual suggestions.
- **Hover_Preview**: Mini-card shown on tree node hover with description and optional screenshot.
- **Auto_Expand**: When search returns results, expand tree branches that contain matches so results are visible.
- **Inline_Edit**: Admin modal to edit feature description (and optional fields) without leaving the page.
- **Virtualized_Tree**: Tree rendered with react-window so only visible rows are in the DOM (fixes load time for large trees).

---

## R-FO1: AI Search (RAG Suggestions)

**User Story:** As a user, I want search to understand natural language and suggest relevant features using the knowledge base, so I find the right feature quickly.

### Acceptance Criteria

1. THE system SHALL provide search that combines keyword match and RAG-based suggestions.
2. RAG SHALL use the existing KB/vector index (e.g. feature descriptions or docs) to return contextual feature IDs for the query.
3. WHEN the user submits a query (e.g. "Zeig Import Features" or "budget variance"), THE system SHALL return a list of feature IDs (and optional snippets) for navigation.
4. THE API SHALL support `GET /api/features/search?q=...` and optionally `rag=1` to enable RAG suggestions; when RAG is unavailable, keyword fallback SHALL be used.
5. THE frontend SHALL display AI suggestions (e.g. "Suggest" button or inline suggestions) and, on selection, navigate to the corresponding tree node and detail.

---

## R-FO2: Hover Previews on Tree

**User Story:** As a user, I want to see a short preview when hovering a tree node, so I can decide whether to click without opening the detail panel.

### Acceptance Criteria

1. WHEN the user hovers a tree node, THE system SHALL show a mini-card (tooltip/popover) after a short delay (e.g. 300–500 ms).
2. THE mini-card SHALL display at least: feature/page name, short description (truncated), and optional screenshot thumbnail when available.
3. THE mini-card SHALL not block interaction; it SHALL dismiss on mouse leave or when the user clicks elsewhere.
4. THE mini-card SHALL use Tailwind styling consistent with the detail card (rounded, shadow) and SHALL be positioned near the cursor or below the node.

---

## R-FO3: Auto-Expand Tree on Search

**User Story:** As a user, I want the tree to expand automatically to show search results, so I don’t have to open every branch manually.

### Acceptance Criteria

1. WHEN a search is performed and results (or highlight IDs) are set, THE tree SHALL expand all branches that contain at least one matching (highlighted) node.
2. Expansion SHALL apply to the current tree data; when search is cleared, THE tree MAY restore previous expand state or leave expanded.
3. THE first matching node MAY be auto-selected and scrolled into view when results come from AI suggest.

---

## R-FO4: Admin Inline-Edit Modal

**User Story:** As an admin, I want to edit a feature’s description (and metadata) in a modal without leaving the Features Overview page.

### Acceptance Criteria

1. THE detail panel SHALL show an "Edit" button (e.g. lucide-react Edit icon) when a feature is selected; visibility MAY be restricted by role (e.g. admin or feature_edit permission).
2. WHEN the user clicks Edit, THE system SHALL open a modal with a form containing at least: name, description (textarea), and optionally link, icon, screenshot_url.
3. THE form SHALL submit to an update API (e.g. PATCH/PUT feature or existing `/api/features/update` or Supabase update); on success, THE modal SHALL close and THE detail card and tree SHALL reflect the updated data.
4. THE modal SHALL be accessible (focus trap, Escape to close, aria labels).

---

## R-FO5: Load Time and Caching

**User Story:** As a user, I want the Features Overview to load quickly and not refetch unnecessarily.

### Acceptance Criteria

1. THE page SHALL use lazy loading for tree children where applicable (e.g. load feature catalog once; children rendered on demand or virtualized).
2. THE tree SHALL be virtualized (e.g. react-window) so only visible rows are rendered; scrolling SHALL remain smooth for large trees (100+ nodes).
3. Feature catalog and docs data SHALL be fetched with react-query (or equivalent) with staleTime of at least 5 minutes so repeated visits do not trigger unnecessary network requests.
4. THE initial load SHALL show a loading state (e.g. Suspense fallback or spinner) until catalog and docs are available; THE tree and detail SHALL not block each other unnecessarily.

---

## Summary Table

| ID     | Title                     | Priority |
|--------|---------------------------|----------|
| R-FO1  | AI Search (RAG)           | Must     |
| R-FO2  | Hover Previews            | Must     |
| R-FO3  | Auto-Expand on Search     | Must     |
| R-FO4  | Admin Inline-Edit Modal   | Must     |
| R-FO5  | Load Time + Caching       | Must     |
