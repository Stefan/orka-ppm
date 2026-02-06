# Warum Laufzeit-API-Fehler nicht durch die Tests gefunden werden

## Beobachtete Fehler (Browser / Laufzeit)

- **GET http://localhost:3000/api/projects 500 (Internal Server Error)** – Projects-Seite ruft die Next.js-Route `/api/projects` auf; die Route oder das Backend antwortet mit 500.
- **GET http://localhost:8000/api/rbac/user-permissions net::ERR_CONNECTION_TIMED_OUT** – Direkter Aufruf ans Backend (Port 8000); Backend läuft nicht oder ist nicht erreichbar.
- **GET http://localhost:8000/api/ai/help/languages net::ERR_CONNECTION_TIMED_OUT** – Dasselbe, Backend nicht erreichbar.

## Gründe, warum die bestehenden Tests das nicht abdecken

### 1. Frontend ruft echte URLs auf, Tests nutzen gemocktes `fetch`

- In **Jest** wird `global.fetch` in `jest.setup.js` global gemockt und liefert immer erfolgreiche Antworten (z. B. 200, Mock-Daten).
- Jeder Aufruf von `fetch('/api/projects')` oder `fetch('http://localhost:8000/...')` geht in den Tests **nicht** ins Netzwerk, sondern in den Mock.
- **Folge:** Weder 500-Antworten noch `ERR_CONNECTION_TIMED_OUT` treten in den Unit-/Integrations-Tests auf; die Tests „sehen“ nur die gemockten Erfolgsfälle.

### 2. API-Route-Tests testen die Route isoliert mit gemocktem Backend

- Die Tests für **GET /api/projects** (z. B. `__tests__/api-routes/projects.route.test.ts`) rufen den **Route-Handler** direkt auf und ersetzen `global.fetch` durch einen Test-Mock.
- Es wird z. B. getestet: „Wenn das Backend 401 zurückgibt, gibt die Route 401 zurück“ und „Wenn `fetch` wirft, gibt die Route 500 zurück“.
- Es wird **kein** laufender Next.js- und Backend-Server verwendet; das echte Backend (Port 8000) wird nie angefragt.
- **Folge:** Ein 500-Fehler, der nur entsteht, wenn das **echte** Backend einen Fehler wirft oder falsch antwortet, wird von diesen Tests nicht erzeugt und daher nicht gefunden.

### 3. Keine E2E-Tests mit echtem Frontend + Backend für diese Flows

- E2E-Tests (z. B. Playwright) könnten die App im Browser gegen einen laufenden Backend-Server testen.
- Aktuell decken die E2E-Tests z. B. die Projects-Seiten-Struktur ab, aber **nicht** gezielt die Fälle „Backend antwortet 500“ oder „Backend nicht erreichbar“.
- **Folge:** Typische Laufzeitfehler (500, Timeout, Backend aus) treten nur beim echten Öffnen der App auf und werden von der aktuellen Testpyramide nicht abgedeckt.

### 4. Direkte Aufrufe ans Backend (Port 8000)

- Die Projects-Seite ruft z. B. `http://localhost:8000/api/rbac/user-permissions` direkt auf (nicht über die Next.js-API).
- In Jest wird `fetch` global gemockt; die URL wird in vielen Setups nicht unterschieden, oder der Mock liefert immer Erfolg.
- **Folge:** `ERR_CONNECTION_TIMED_OUT` (Backend läuft nicht) passiert in der Testumgebung nie, weil nie eine echte Netzwerkanfrage gestellt wird.

## Was würde diese Fehler finden?

| Fehlerart | Sinnvolle Testart | Beschreibung |
|-----------|--------------------|--------------|
| 500 von `/api/projects` (Next.js-Route / Backend) | **Route-Unit:** Backend-Mock gibt 500 zurück → Route gibt 500 zurück. **Seiten-Unit:** `fetch` für `/api/projects` mocken mit 500 → UI zeigt Fehler/Retry. | Bereits teilweise (Route: „fetch throws → 500“). Zusätzlich: explizit Backend-500 und **Seiten-Test** für Fehleranzeige. |
| Backend nicht erreichbar (Timeout / Connection refused) | **Route-Unit:** `fetch` wirft → Route 500 (vorhanden). **Seiten-Unit:** `fetch` wirft → UI zeigt z. B. „Backend not running“ oder Retry. | Seiten-Test mit geworfenem `fetch` fehlt bzw. wurde ergänzt. |
| Echte Integration (Frontend + Backend laufen) | **E2E:** Browser öffnet /projects, Backend läuft nicht oder antwortet 500 → Assert auf Fehlermeldung / Retry-Button. | Optional: E2E-Szenarien „Backend down“ / „Backend 500“ für kritische Seiten. |

## Konkrete Maßnahmen im Projekt

1. **API-Route GET /api/projects**  
   - Bereits getestet: Backend 200/401, fetch wirft → 500.  
   - Optional: Ein weiterer Fall „Backend antwortet mit 500“ → Route gibt 500 weiter.

2. **Projects-Seite (Fehlerbehandlung)**  
   - **Neuer Unit-Test:** `fetch('/api/projects')` wird so gemockt, dass er einmal 500 zurückgibt oder wirft.  
   - Assert: Nach dem Ladevorgang wird eine Fehlermeldung und ein Retry-Button angezeigt.  
   - So werden Regressions in der **Fehlerbehandlung** der Seite abgesichert, auch wenn der echte 500 oder Timeout nur in der Laufzeit auftritt.

3. **E2E (optional)**  
   - Szenario „Backend nicht erreichbar“ oder „Backend gibt 500 für /projects“ mit laufender App und (abgeschaltetem oder fehlerhaftem) Backend, mit Assert auf Fehler-UI.

## Kurzfassung

- Die Fehler treten in der **Laufzeit** auf (echtes Netzwerk, echtes Backend).
- **Unit-/Integrations-Tests** nutzen durchgehend **gemocktes `fetch`** und teilweise gemocktes Backend; sie simulieren keine echten 500 oder Timeouts gegen localhost:8000.
- **E2E-Tests** laufen aktuell nicht mit „Backend aus“ oder „Backend 500“ für diese Flows.
- Durch **gezielte Unit-Tests für die Fehlerbehandlung** (z. B. Projects-Seite bei 500 / fetch wirft) können zumindest Regressions in der UI-Logik abgefangen werden; die eigentliche Ursache (Backend-Bug oder Backend nicht gestartet) bleibt eine Laufzeit-/Betriebsfrage und wird durch E2E oder manuelle Checks abgedeckt.
