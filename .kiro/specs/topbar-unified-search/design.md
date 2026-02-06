# Design: Topbar Unified Search

## Overview

Suchfeld in der Topbar mit Hybrid Fulltext (pg_trgm) + Semantic (RAG/Vector), AI-Auto-Suggest, Result-Cards, Voice-Input und personalisierter Filterung. Das Suchfeld wird in der TopBar integriert; AppLayout bleibt unverändert.

## Architecture

### Layout

- **AppLayout.tsx**: Keine Strukturänderung; rendert weiterhin TopBar.
- **TopBar.tsx**: Flex-Header; zwischen Logo/Nav und rechter Gruppe (Theme, Sprache, User) wird die neue Such-Komponente eingefügt.
- **TopbarSearch.tsx**: Eigenständige Client-Komponente mit Input, Debounce, Dropdown, Voice-Button.

### Topbar Placement

- Suchfeld: `w-full md:w-96`, Tailwind `focus:ring-2 focus:shadow`, in einer Flex-Zone mit `flex-1 max-w-md mx-4` (oder vergleichbar) zwischen Nav und rechter Seite.
- So bleibt die TopBar die einzige Stelle für Header-Änderungen.

### Dropdown

- Position: absolut unter dem Input.
- Styling: `rounded-xl shadow-lg`, `overflow-y-auto max-h-96`, z-index über anderen Menüs.
- Schließen: Klick außerhalb, Escape, oder Navigation zu einem Ergebnis.

### Result-Card

- Layout: Flex mit Icon (lucide), Title, Description-Snippet, optional Thumbnail (next/image, lazy).
- Hover: `hover:bg-blue-50` (bzw. dark-mode-tauglich).
- Klick: Navigation zu `href` (Next.js Link oder router.push).

### Voice

- Mikrofon-Button (lucide Mic) rechts im Input, innerhalb des Input-Containers.
- Web Speech API: Transkript → Query setzen und Suche auslösen.
- Fallback: Button ausblenden oder disabled, wenn API nicht verfügbar.

### Data Flow

1. User tippet oder spricht → Input (debounced 300 ms).
2. Frontend: GET an Next.js `app/api/search?q=...` (optional `role`/`org` wenn Backend sie nicht aus Token ableitet).
3. Next.js Route: Proxy zu FastAPI `GET /api/v1/search?q=...&limit=10` mit Auth-Header.
4. Backend: Kombination aus Fulltext (pg_trgm), Semantic (RAG/vector_chunks), Auto-Suggest (LLM); Personalisierung nach Rolle/Org.
5. Response: Einheitliches JSON z. B. `{ fulltext: [], semantic: [], suggestions: [], meta: { role } }`.
6. Frontend: Dropdown mit Result-Cards und optional gruppiert nach Typ.

## Component Hierarchy

```
TopBar
├── Logo + Menu
├── Nav links
├── TopbarSearch          ← new
│   ├── Input (Search icon, placeholder)
│   ├── Mic button
│   └── Dropdown
│       ├── ResultCard (x N)
│       └── …
└── Theme / Language / User
```

## API Contract

### GET /api/v1/search (Backend)

- **Query params**: `q` (string), `limit` (optional, default 10).
- **Auth**: Bearer token; user/role/org from token.
- **Response**:
  - `fulltext`: Array of { type, id, title, snippet, href, metadata? }
  - `semantic`: Array of { type, id, title, snippet, href, score?, metadata? }
  - `suggestions`: Array of string (AI suggestions)
  - `meta`: { role?: string }

### GET /api/search (Next.js Proxy)

- Forwards to Backend with Authorization header.
- Query params passed through.

## Technology

- **Frontend**: Next.js 16, Tailwind, lucide-react, react-query (or SWR), next/image.
- **Backend**: FastAPI, Supabase client, existing HelpRAGAgent/vector_chunks, pg_trgm.
- **Voice**: Web Speech API (browser).
