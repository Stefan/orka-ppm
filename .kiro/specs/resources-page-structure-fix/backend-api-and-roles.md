# Resources: Backend-API, Routen & Rollen (Stand Codebasis)

Dieses Dokument beschreibt die **bestehenden** Backend-Routen, Next.js-Proxy-Routen, RBAC-Rollen und Migrationen für die Resources-Funktionalität. Alle Tasks in `tasks.md` sind an diese Realität angepasst.

---

## 1. Backend (FastAPI)

**Router:** `backend/routers/resources.py`  
**Prefix:** `/resources`  
**Registrierung:** `main.py` → `app.include_router(resources_router)` (ohne weiteren Prefix)

| Methode | Pfad | Permission | Beschreibung |
|--------|------|------------|--------------|
| POST | `/resources/` | `resource_create` | Neuen Resource anlegen |
| GET | `/resources/` | `resource_read` | Liste aller Resources (mit Availability-Metriken) |
| GET | `/resources/{resource_id}` | `resource_read` | Einzelne Resource abrufen |
| PUT | `/resources/{resource_id}` | `resource_update` | Resource aktualisieren |
| DELETE | `/resources/{resource_id}` | `resource_delete` | Resource löschen |
| POST | `/resources/search` | `resource_read` | Suche (Skills, Capacity, Availability, Role, Location) |
| GET | `/resources/utilization/summary` | `resource_read` | Nutzungs-Summary für Analytics |

**Modelle (Pydantic):** `backend/models/resources.py`  
- `ResourceCreate`: name, email, role (optional, default ""), capacity, availability, hourly_rate, skills, location  
- `ResourceUpdate`: alle Felder optional  
- `ResourceResponse`: Response-Schema inkl. berechneter Felder (utilization_percentage, available_hours, …)

---

## 2. Next.js API-Proxy

**Datei:** `app/api/resources/route.ts`  
**Basis-URL Frontend:** `getApiUrl('/resources')` → `/api/resources`

| Frontend-Aufruf | Next.js Route | Weiterleitung an Backend |
|-----------------|--------------|--------------------------|
| GET `/api/resources` | `app/api/resources/route.ts` (GET) | GET `{BACKEND_URL}/resources/` |
| POST `/api/resources` | `app/api/resources/route.ts` (POST) | POST `{BACKEND_URL}/resources/` |

**Hinweis:** PUT, DELETE, GET by ID, POST `/search`, GET `/utilization/summary` sind **nur** direkt ans Backend angebunden, wenn das Frontend `NEXT_PUBLIC_BACKEND_URL` bzw. eine direkte Backend-URL nutzt. Die Resources-Page (`app/resources/page.tsx`) nutzt aktuell nur `getApiUrl('/resources')` → also nur **Liste (GET)** und **Anlegen (POST)** über den Proxy. Für Update/Delete/Search/Utilization müsste entweder der Proxy erweitert oder das Frontend auf Backend-URL umgestellt werden.

**Fehlerweiterleitung:** Bei `!response.ok` wird die Backend-JSON-Antwort (inkl. `detail` bei 422) unverändert an das Frontend durchgereicht (Stand nach Fix 422-Anzeige).

---

## 3. RBAC-Rollen (Resources-relevante Permissions)

**Quelle:** `backend/auth/rbac.py`  
**Permissions:** `resource_create`, `resource_read`, `resource_update`, `resource_delete`, `resource_allocate`

| Rolle | resource_create | resource_read | resource_update | resource_delete | resource_allocate |
|-------|-----------------|---------------|-----------------|-----------------|-------------------|
| **admin** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **portfolio_manager** | – | ✓ | – | – | ✓ |
| **project_manager** | – | ✓ | – | – | ✓ |
| **resource_manager** | ✓ | ✓ | ✓ | **–** | ✓ |
| **team_member** | – | ✓ | – | – | – |
| **viewer** | – | ✓ | – | – | – |

Hinweis: **resource_manager** hat bewusst **kein** `resource_delete` (nur Admin darf löschen).

---

## 4. Migrationen (Resources-Tabelle)

- **001_initial_schema_enhancement.sql:** Erweiterung der Tabelle `resources` um Spalten: `email` (UNIQUE), `role`, `availability`, `hourly_rate`, `current_projects`, `capacity`, `location`. Die Tabelle `resources` wird nicht in 001 angelegt, nur erweitert (vorhandene Basis-Tabelle).
- **024_tenant_isolation_policies.sql:** Enthält **keine** RLS-Policies für die Tabelle `resources`. Die Resources-Tabelle hat aktuell **kein** `tenant_id` und keine Row-Level-Security in dieser Migration.
- Weitere migrationsrelevante Erwähnung: `supabase_schema_enhancement.sql` (Spalten-Checks für `resources`).

Für Multi-Tenant-Isolation von Resources müsste eine **neue Migration** (z. B. `tenant_id` auf `resources`, RLS-Policies, ggf. `get_current_tenant_id()`) ergänzt werden – aktuell nicht Teil dieser Spec.

---

## 5. Abgleich Spec ↔ Code

- **Create Resource (422-Fix):** Backend akzeptiert `role` optional (`Optional[str] = ""`). Next.js-Proxy leitet Fehlerbody (`detail`) bei 4xx/5xx unverändert weiter. Frontend zeigt `detail` bzw. `error` in der Fehlermeldung.
- **Struktur-Tests (resources-grid):** Siehe `tasks.md` Tasks 1–7; alle an View-Modes und bestehende DOM-Struktur angepasst.
- Erweiterungen (z. B. Proxy für PUT/DELETE/Search/Utilization, Tenant-Migration) sind als optionale Tasks in `tasks.md` aufgeführt.
