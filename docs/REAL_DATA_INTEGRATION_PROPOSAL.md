# Vorschlag: Mock-Bereiche mit echten DB/API-Daten anbinden

Konkrete API- und Frontend-Anpassungen, um die bisher mit Mock- oder Sample-Daten betriebenen Bereiche auf echte Backend-Daten umzustellen.

---

## 1. Risiken (Risks)

### Ist
- **Backend:** Vollständig vorhanden unter `backend/routers/risks.py` (Prefix `/risks`).
- **Endpoints:** `GET /risks`, `GET /risks/{id}`, `POST /risks`, `PUT /risks/{id}`, `DELETE /risks`; Filter: `project_id`, `category`, `status`, `owner_id`. Zusätzlich Issues-Router unter `/issues`.
- **Next.js:** Rewrite `/api/:path*` → Backend `/:path*` → Aufruf `GET /api/risks` landet als `GET /risks` beim Backend.

### Vorschlag Backend
- Keine Änderung nötig.
- Optional: Aggregation für Dashboard (z. B. `GET /risks/summary?project_id=…`) für Zählungen nach Status/Kategorie/Risiko-Score, falls gewünscht.

### Vorschlag Frontend
- **Datei:** `app/risks/page.tsx`
- **Änderung:** Statt festem `sampleRisks` und abgeleiteten `sampleAlerts`/Trend-Daten:
  - Beim Mount (und bei Filteränderung): `fetch('/api/risks', { headers: { Authorization: Bearer token } })` sowie ggf. `fetch('/api/issues', …)`.
  - Query-Parameter aus UI: `project_id`, `category`, `status` (und ggf. `owner_id`) an die URL anfügen.
  - Antwort als Liste speichern; bestehende Aggregationen (high/medium/low, byCategory, byStatus, avgRiskScore, trendData) aus dieser Liste clientseitig berechnen (oder über neues Summary-Endpoint, falls gebaut).
- **Alerts:** Entweder aus derselben Risiken-Liste ableiten (z. B. hoher Score / Fälligkeit) oder separates Backend-Endpoint für „Risiko-Alerts“, sofern vorhanden.

### Datenmodell Abgleich
- Backend-Modelle: `models/risks.py` (`RiskCreate`, `RiskResponse`, `RiskUpdate`, `RiskCategory`, `RiskStatus`).
- Frontend-Interface `Risk` in `app/risks/page.tsx` an Felder von `RiskResponse` anpassen (z. B. `id`, `project_id`, `name`, `description`, `probability`, `impact`, `risk_score`, `category`, `status`, `owner_id`, `created_at`, …).

---

## 2. Audit (Anomalien, Export)

### Ist
- **Backend:** `backend/routers/audit.py` (Prefix `/api/audit`) mit u. a.:
  - `POST /api/audit/detect-anomalies` (Request Body: `time_range_days`, ggf. Filter)
  - `POST /api/audit/export`, `POST /api/audit/export/pdf`, `POST /api/audit/export/csv`
  - `POST /api/audit/anomaly/{anomaly_id}/feedback`
- **Next.js:** Eigene Route `app/api/audit/detect-anomalies/route.ts` und `app/api/audit/export/[format]/route.ts` liefern aktuell **Mock-Daten**.

### Vorschlag Backend
- Keine Änderung nötig; Anomalie-Erkennung und Export sind implementiert.

### Vorschlag Frontend / Next.js API
- **Detect-Anomalies:**  
  - **Option A:** Next.js-Route `app/api/audit/detect-anomalies/route.ts` zu einem **Proxy** umbauen: Request (Body, Auth-Header) an `POST ${BACKEND_URL}/api/audit/detect-anomalies` durchreichen, Response unverändert zurückgeben.  
  - **Option B:** Frontend ruft direkt `fetch(NEXT_PUBLIC_BACKEND_URL + '/api/audit/detect-anomalies', …)` auf (CORS muss erlauben).
- **Export:**  
  - `app/api/audit/export/[format]/route.ts` als Proxy: Request an `POST ${BACKEND_URL}/api/audit/export` (oder `/api/audit/export/pdf` bzw. `/export/csv`) durchreichen, Binary/Stream zurück an den Client.
- **Anomaly-Feedback:**  
  - Wenn die Audit-UI Feedback schickt: Aufruf an `POST /api/audit/anomaly/{id}/feedback` (über Proxy oder direkt Backend), Request-Body wie vom Backend erwartet (z. B. `is_false_positive`, `feedback_notes`).

### Vertrag (zum Abgleich)
- **Detect-Anomalies Request:** `{ "time_range_days": number, (optional) filters }`  
- **Detect-Anomalies Response:** `{ "anomalies": Array<{ log_id, timestamp, user_id, user_name, action, confidence, reason, details }>, "anomaly_count": number, … }`  
- **Export Request:** Body wie in Backend `ExportRequest` (z. B. `filters` mit `start_date`, `end_date`, `user_id`, …).  
- **Export Response:** PDF/CSV als Datei-Stream mit passendem `Content-Disposition`-Header.

---

## 3. Änderungsmanagement (Changes)

### Ist
- **Backend:** Ausführlicher Router `backend/routers/change/change_management.py` (Prefix `/changes`) mit CRUD, Approvals, Implementation, Impact, Templates, Audit-Trail – **ist in `main.py` derzeit nicht eingebunden** (nur `change_orders`, `change_approvals`, `change_analytics`).
- **Frontend:**  
  - `app/changes/components/ChangeRequestManager.tsx` lädt über `mockDataService.getChangeRequests()`.  
  - `ApprovalWorkflowConfiguration.tsx` und `ImplementationTracker.tsx` nutzen lokale Mock-Arrays.

### Vorschlag Backend
- **Change-Management-Router aktivieren:** In `backend/main.py`:
  - `from routers.change.change_management import router as change_management_router`
  - `app.include_router(change_management_router)`
- Damit sind unter `/changes` u. a. verfügbar:
  - `GET /changes`, `POST /changes`, `GET /changes/{id}`, `PUT /changes/{id}`, `DELETE /changes/{id}`
  - `GET /changes/approvals/pending`, `POST /changes/approvals/{approval_id}/decide`, `GET /changes/{id}/implementation`, `PUT /changes/{id}/implementation/progress`, …
  - `GET /changes/templates`, `GET /changes/analytics`, etc.

### Vorschlag Frontend
- **ChangeRequestManager:**
  - Statt `mockDataService.getChangeRequests()`: z. B. `fetch('/api/changes', { headers: { Authorization: Bearer token } })` (optional mit Query: `project_id`, `status`, `change_type`, `priority`, `page`, `page_size`).
  - Einzelansicht: `GET /api/changes/{id}`.
  - Erstellen/Bearbeiten/Löschen: `POST /api/changes`, `PUT /api/changes/{id}`, `DELETE /api/changes/{id}`.
  - Response-Typ an Backend-Modelle anpassen (`ChangeRequestResponse` in `models/change_management.py`).
- **ApprovalWorkflowConfiguration:**
  - Approval-Regeln/Authority Matrix/Templates: Sofern im Backend unter `/changes` (z. B. Templates: `GET /changes/templates`) vorhanden, diese Endpoints aufrufen und Zustand aus Response setzen. Fehlt ein dedizierter Endpoint für „Approval Rules“ oder „Authority Matrix“, entweder in Backend ergänzen oder vorerst weiter Mock, aber klar als „Konfiguration noch nicht aus DB“ markieren.
- **ImplementationTracker:**
  - Implementation-Status: `GET /api/changes/{change_id}/implementation` nutzen; Updates: `PUT /api/changes/{change_id}/implementation/progress` (und ggf. weitere Endpoints aus `change_management.py`). Mock-Objekt durch API-Response ersetzen.

### Next.js / Rewrite
- Aktuell: `/api/:path*` → Backend `/:path*`.  
- Aufruf `GET /api/changes` → Backend `GET /changes`. Kein zusätzlicher Rewrite nötig, sobald der Router eingebunden ist.

---

## 4. Monte Carlo

### Ist
- **Backend:** `backend/routers/simulations.py` (Prefix `/api/v1/monte-carlo`) mit Simulation Run, Szenarien, Visualisierung, Export.
- **Frontend:** `app/monte-carlo/page.tsx` nutzt lokale `sampleHistory` und `sampleRisks`.

### Vorschlag Backend
- Bestehende Endpoints für Runs, Szenarien und Ergebnisse prüfen (z. B. Liste vergangener Simulationen, Run mit Risiken/Parametern). Fehlt ein „History“-Endpoint, z. B. `GET /api/v1/monte-carlo/simulations` oder `GET /api/v1/monte-carlo/runs` mit optionalen Filtern, anlegen und Response-Format dokumentieren.

### Vorschlag Frontend
- **Simulation History:** Statt `sampleHistory` beim Mount `GET /api/v1/monte-carlo/...` (z. B. Runs/History) aufrufen und Ergebnis in State setzen.
- **Risiken für Konfiguration:** Entweder aus Registers/Risiken-API (`GET /api/risks` oder Registers) laden oder aus Monte-Carlo-spezifischem Endpoint, sofern vorhanden. Kein hartkodiertes `sampleRisks`.
- Request/Response an die in `simulations.py` definierten Pydantic-Modelle (z. B. `SimulationRequest`, `RiskCreateRequest`) anpassen.

---

## 5. PMR (Projekt-Monatsbericht)

### Ist
- **Backend:** `backend/routers/enhanced_pmr.py` (Prefix `/api/reports/pmr`) mit Endpoints für Report-Erstellung, -Abfrage, ggf. AI-Insights.
- **Frontend:** `app/reports/pmr/page.tsx` lädt einen „mock report“ und „mock insights“.

### Vorschlag Backend
- Prüfen, ob es Endpoints gibt für: (1) aktuellen Report laden (z. B. `GET /api/reports/pmr/current` oder `GET /api/reports/pmr?project_id=…&month=…`), (2) Report anlegen/aktualisieren, (3) AI-Insights generieren. Fehlende Endpoints ergänzen und in OpenAPI/Redoc dokumentieren.

### Vorschlag Frontend
- **Report laden:** Statt festem `mockReport` z. B. `GET /api/reports/pmr/...` mit Projekt/Zeitraum aufrufen und `currentReport` aus Response setzen.
- **Insights:** Statt lokalem Mock: Aufruf an Backend-Endpoint für PMR-Insights (z. B. `POST /api/reports/pmr/insights` oder wie in enhanced_pmr definiert), Ergebnis in State übernehmen.
- Typen (`PMRReport`, `AIInsight`) an Backend-Response anpassen.

---

## 6. Visual Guides

### Ist
- **Backend:** Unter `help_chat` (Prefix `/api/ai/help`) z. B. `GET /api/ai/help/visual-guides/recommendations`, `GET /api/ai/help/visual-guides/{guide_id}`, `POST .../track-completion`. Zusätzlich standalone `backend/routers/visual_guides.py` (Prefix `/visual-guides`) – prüfen, ob in `main.py` inkludiert.
- **Frontend:** `components/help-chat/VisualGuideManager.tsx` nutzt `generateMockGuides()`.

### Vorschlag Backend
- Sicherstellen, dass genau ein Weg für Visual Guides genutzt wird (entweder Help-Chat-Sub-Routen oder standalone `/visual-guides`). Wenn standalone nicht inkludiert ist: entweder Router in `main.py` einbinden oder Frontend ausschließlich auf Help-Chat-Routen führen.

### Vorschlag Frontend
- **VisualGuideManager:** Beim Laden z. B. `GET /api/ai/help/visual-guides/recommendations` (mit Kontext/Route, falls vom Backend unterstützt) aufrufen. Response als Liste von Guides in State setzen; keine `generateMockGuides()` mehr.
- Einzelguide: `GET /api/ai/help/visual-guides/{guide_id}`.
- Completion: `POST /api/ai/help/visual-guides/{guide_id}/track-completion`.
- Response-Format mit Backend-Modell (z. B. `VisualGuideResponse`) abgleichen.

---

## 7. Kurz-Checkliste (Priorität)

| Bereich           | Backend-Anpassung                    | Frontend-Anpassung                                      |
|-------------------|--------------------------------------|---------------------------------------------------------|
| **Risiken**       | Optional: Summary-Endpoint           | `app/risks/page.tsx`: Fetch `/api/risks` (und ggf. `/api/issues`), Aggregation aus Liste |
| **Audit**         | –                                    | Next.js-Routen detect-anomalies + export als Proxy zum Backend |
| **Changes**      | `change_management_router` in main   | ChangeRequestManager + ApprovalConfig + ImplTracker an `/api/changes` anbinden |
| **Monte Carlo**   | Optional: History/Runs-Endpoint      | History + Risiken aus API statt Sample-Daten           |
| **PMR**           | Fehlende Endpoints ergänzen          | Report + Insights von Backend laden                    |
| **Visual Guides** | Einheitlicher Zugang (help vs. standalone) | VisualGuideManager: Recommendations + Guide + Track von API |

---

## 8. Nächste Schritte

1. **Schnell umsetzbar:** Risiken (nur Frontend auf `/api/risks` umstellen) und Audit (Next.js-Routen als Proxy).
2. **Backend + Frontend:** Change Management (Router einbinden, dann Frontend auf `/api/changes` umstellen).
3. **Danach:** Monte Carlo, PMR, Visual Guides je nach Priorität und vorhandenen Backend-Endpoints.

Wenn du mit einem Bereich starten willst (z. B. nur Risiken oder nur Changes), kann der nächste Schritt eine konkrete Patch-Liste (Dateien + Code-Snippets) dafür sein.
