# Feature Spec: Fehlende AI-Features (AI Gaps)

Zentrale Spezifikation der fehlenden bzw. unvollständigen AI-Feature-Bereiche. Jeder Abschnitt definiert Anforderungen und Akzeptanzkriterien ohne Implementierungsdetails.

---

## 1. AI-Anomaly Detection

### 1.1 Proaktive Alerts (Browser-Push)

**Anforderung:** Bei neuer Variance-Alert soll der Nutzer optional eine Browser-Push-Benachrichtigung erhalten (z. B. „Abweichung in Invoice Value – check PO #123“).

**Akzeptanzkriterien:**
- Nutzer kann Push-Benachrichtigungen für Variance-Alerts aktivieren/deaktivieren.
- Bei neuer Alert (gemäß VarianceAlertService) wird eine Push-Nachricht an registrierte Clients gesendet, sofern der Kanal PUSH für die Rule aktiv ist.
- Frontend: Service Worker (z. B. `public/sw.js`) verarbeitet Push-Events und zeigt eine Notification.
- Optional: Backend-Endpoint zum Registrieren von Push-Subscriptions (VAPID); Speicherung der Subscriptions pro User.

**UI-Platzierung:** Permission-Anfrage und Toggle in Einstellungen oder im VarianceAlerts-Bereich (z. B. „Push bei neuen Alerts“).

---

### 1.2 Root-Cause-UI

**Anforderung:** Pro Alert optional eine AI-gestützte Ursachenanalyse anzeigen (z. B. „Ursache: Vendor Delay – 87% Wahrscheinlichkeit“).

**Akzeptanzkriterien:**
- Backend: Service oder Erweiterung (z. B. `get_root_cause_suggestions(alert_id)`) liefert eine oder mehrere Ursachen mit Konfidenz (0–100 %).
- Implementierung kann LLM oder regelbasiert sein; bei Fehler/Timeout: Fallback oder leere Liste.
- Frontend: In VarianceAlerts bzw. Alert-Detail ein Block „Root Cause“ mit Ursache(n) und Confidence-Anzeige.
- Nutzer kann Root-Cause-Anzeige pro Alert ein- und ausblenden (optional).

**UI-Platzierung:** In der Alert-Karte bzw. im Alert-Detail-Modal in `app/dashboards/components/VarianceAlerts.tsx`.

---

### 1.3 AI-Auto-Fix-Vorschläge

**Anforderung:** Konkrete Vorschläge zur Behebung von Varianzen (z. B. „Reduziere ETC um 5k€ – simuliere Impact“).

**Akzeptanzkriterien:**
- Backend: Endpoint oder Erweiterung, der zu einem Alert/Variance konkrete Adjustments vorschlägt (ETC, Accruals, ggf. andere Spalten).
- Jeder Vorschlag enthält: Beschreibung, betroffene Kennzahl, empfohlene Änderung, optional geschätzter Impact.
- Optional: Anbindung an Impact-Simulation (z. B. Monte Carlo oder EAC-Rechnung).
- Frontend: Button „Vorschläge anzeigen“ am Alert; Modal mit Liste der Vorschläge und Aktionen „Impact simulieren“ / „Übernehmen“ (Übernehmen kann als „Copy to Clipboard“ oder Integration in Costbook starten).

**UI-Platzierung:** Button in VarianceAlerts-Alert-Karte; Modal für Vorschlagsliste und Aktionen.

---

## 2. Natural Language Search

### 2.1 Semantic Search im Costbook

**Anforderung:** Suche versteht semantisch ähnliche Formulierungen (z. B. „Hohe Variance in Forecast“) und filtert Panels/Spalten entsprechend, nicht nur nach exaktem Keyword.

**Akzeptanzkriterien:**
- Query-Intent wird erkannt (z. B. „high variance“, „forecast“, „over budget“) und auf Costbook-Filter (Spalten, Schwellenwerte) abgebildet.
- Entweder: Erweiterung des NL-Query-Parsers um Synonyme/Intent-Mapping, oder Anbindung an Embedding-Service für Costbook-Metadaten (Spaltennamen, Beschreibungen).
- Costbook-Filter-State wird anhand des erkannten Intents gesetzt; Ergebnisliste wird entsprechend gefiltert.
- Bei mehrdeutigen Queries: sinnvolle Default-Interpretation oder Rückfrage (optional).

**UI-Platzierung:** Bestehendes NL-Suchfeld im Costbook-Header; Ergebnis wie bisher, aber mit erweitertem Intent-Verständnis.

---

### 2.2 AI-Vorschläge „Ähnliche Suchen“

**Anforderung:** Nach einer Suche 2–3 ähnliche Suchphrasen anzeigen (z. B. „Ähnliche Suchen: Open Committed pro Vendor“).

**Akzeptanzkriterien:**
- Aus aktueller Query und Kontext (z. B. sichtbare Spalten, letzte Suchen) werden 2–3 ähnliche Suchphrasen generiert.
- Generierung kann im Backend (LLM) oder Frontend (vordefinierte Mappings / einfache Varianten) erfolgen.
- Anzeige in oder unter dem NL-Suchfeld (z. B. in `SearchSuggestions.tsx` oder `NLSearchInput.tsx`).
- Klick auf einen Vorschlag setzt die Query und löst die Suche aus.

**UI-Platzierung:** Unter dem NLSearchInput oder in SearchSuggestions nach erfolgter Suche.

---

### 2.3 Voice-Search

**Anforderung:** Im Costbook-Header Spracheingabe für die NL-Suche (Web Speech API).

**Akzeptanzkriterien:**
- Mikrofon-Button neben dem NL-Suchfeld.
- Bei Klick: Web Speech API (SpeechRecognition / webkitSpeechRecognition) starten; Transkript ins Suchfeld übernehmen.
- Nach Ende der Aufnahme: NL-Parse wie bei Texteingabe auslösen (Filter anwenden).
- Fehlerbehandlung: Mikrofon verweigert, Sprache nicht erkannt – Hinweis anzeigen.

**UI-Platzierung:** Mikrofon-Icon neben `NLSearchInput` im Costbook-Header.

---

## 3. Smart Recommendations

### 3.1 Personalisierte Vorschläge

**Anforderung:** Tenant- oder User-spezifische Empfehlungen (z. B. „Für Roche-User: Reduziere Provisions um 8% – spart 42k€“).

**Akzeptanzkriterien:**
- Recommendation-API (Frontend oder Backend) erhält Kontext: `user_id`, `tenant_id` bzw. `organization_id`.
- Backend bzw. Regellogik liefert tenant-/organisationsspezifische Prioritäten, Texte oder zusätzliche Empfehlungen.
- RecommendationsPanel ruft API mit User-Kontext auf und zeigt personalisierte Texte und Prioritäten.
- Ohne Tenant-Kontext: Verhalten wie bisher (generische Empfehlungen).

**UI-Platzierung:** Bestehendes RecommendationsPanel im Costbook; Inhalte personalisiert je nach Kontext.

---

### 3.2 AI-Optimizer-Button (Costbook)

**Anforderung:** Ein Button „Optimiere gesamtes Costbook“ – Auto-Adjustments basierend auf Rules/History.

**Akzeptanzkriterien:**
- Backend: Endpoint (z. B. `POST /api/.../costbook/optimize`) oder Anbindung an bestehende Optimizer-Logik.
- Input: aktuelle Projekte/Spalten (oder Projekt-IDs), optional User/Tenant.
- Output: Liste von vorgeschlagenen Anpassungen (z. B. ETC, Accruals, Distribution) mit Begründung und optional geschätztem Effekt.
- Frontend: Im Costbook-Header oder neben Recommendations ein Button „AI Optimize Costbook“; bei Klick Modal mit Vorschlägen und Aktionen „Apply“ / „Simulate“ (Simulate kann What-If anzeigen).

**UI-Platzierung:** Button im Costbook-Header oder neben RecommendationsPanel; Modal für Vorschlagsliste.

---

## 4. AI-Distribution & Rules

### 4.1 Auto-Vorschläge (Profil/Duration)

**Anforderung:** Beim Öffnen des Distribution-Dialogs eine Empfehlung anzeigen (z. B. „Basierend auf Project-Historie: Custom für Q3 empfohlen“).

**Akzeptanzkriterien:**
- Backend: Endpoint oder Logik, die aus Historie (bisherige Profile pro Projekt/Quartal) eine Empfehlung für Profil (linear/custom) und ggf. Duration liefert, inkl. Kurzbegründung.
- DistributionSettingsDialog lädt beim Öffnen diese Empfehlung und zeigt sie als Banner oder Hinweis (z. B. oberhalb der Profil-Auswahl).
- Nutzer kann Empfehlung übernehmen oder ignorieren.

**UI-Platzierung:** Banner oder Info-Box in `DistributionSettingsDialog.tsx` oben oder neben Profil-Auswahl.

---

### 4.2 Predictive Rules

**Anforderung:** Beim Ändern einer Rule (Profil/Duration/Custom-%) eine Vorhersage anzeigen: „Diese Rule reduziert Variance um ca. X% – apply?“.

**Akzeptanzkriterien:**
- Bei Änderung von Profil/Duration/Custom wird eine kurze Simulation durchgeführt (Backend oder Frontend): aktuelle Variance vs. Variance mit neuer Rule.
- Differenz wird in % (oder absoluter Betrag) ausgewiesen.
- Im Dialog: Beim „Apply“-Button Hinweis „Variance-Reduktion ca. X%“ (oder „-X% Variance“) und Bestätigung.
- Wenn Berechnung nicht möglich: Hinweis ausblenden oder „Simulation nicht verfügbar“.

**UI-Platzierung:** Im DistributionSettingsDialog bei „Apply“; optional kleines Preview-Label bei Profil-Wechsel.

---

## 5. AI-Copilot-Chat

### 5.1 Kontext „User-Data“

**Anforderung:** Der Help-Chat kennt relevante User-Daten (z. B. „Dein EAC ist hoch“) und gibt konkrete, datenbezogene Tipps.

**Akzeptanzkriterien:**
- HelpChatProvider befüllt `relevantData` pro Route (z. B. auf Financials: Top-Projekte, EAC, Variance, aktuelle Seite).
- `relevantData` wird im Request an `/api/ai/help/query` im Context mitgesendet.
- Backend (help_rag_agent): Statt nur `_get_contextual_ppm_data_fast` wird optional voller Kontext genutzt; vom Frontend übergebenes `relevantData` wird in den Prompt eingebaut.
- Antworten können auf konkrete Kennzahlen und Projekte eingehen (z. B. „Bei Projekt X ist die Variance 12% – prüfe ETC“).

**UI-Platzierung:** Keine Änderung der Chat-UI; Kontext wird im Hintergrund mitgeliefert.

---

### 5.2 Voice-Control im Chat

**Anforderung:** Nutzer kann die Frage per Sprache eingeben.

**Akzeptanzkriterien:**
- In der Help-Chat-Sidebar (Chat-Input): Mikrofon-Button.
- Web Speech API (wie in DistributionSettingsDialog): Transkript wird ins Eingabefeld geschrieben; Nutzer kann absenden oder nachbearbeiten.
- Optional: Auto-Submit nach Transkript-Ende (konfigurierbar).

**UI-Platzierung:** Mikrofon-Button neben dem Chat-Eingabefeld in der Help-Chat-Sidebar.

---

### 5.3 AR / Scan PO (Phase 3 – nur Spec)

**Anforderung:** Scan eines PO-Dokuments → Auto-Import/Analyse („Grandiose Idee“).

**Akzeptanzkriterien (Spezifikation, Implementierung Phase 3):**
- Kamera oder Bild-Upload; Backend: OCR + Extraktion PO-Nummer, Beträge, Vendor.
- Anreicherung mit bestehenden PO-Daten; optional Import in Costbook/Financials.
- Klar als späterer Schritt (Phase 3) eingeordnet; keine Implementierung in aktueller Phase.

---

## 6. Predictive Simulations

### 6.1 Multi-Scenario Side-by-Side

**Anforderung:** Echte Side-by-Side-Vergleichsansicht für gespeicherte Monte-Carlo-Szenarien (nicht nur Platzhalter).

**Akzeptanzkriterien:**
- In MonteCarloAnalysisComponent: Wenn „Compare Scenarios“ aktiv und mindestens zwei Szenarien ausgewählt, wird eine Vergleichsansicht angezeigt.
- Inhalt: Tabelle (Szenario × Metriken: z. B. P50, P90, Expected Cost, ggf. Schedule) und/oder kleine Sparklines/Charts pro Szenario.
- Datenquelle: `scenario.results` und bestehende prepareChartData-Logik.
- Platzhalter-Text „Detailed comparison analysis would be displayed here“ wird durch diese Ansicht ersetzt.

**UI-Platzierung:** Im bestehenden „Scenario Comparison“-Bereich in `MonteCarloAnalysisComponent.tsx`.

---

### 6.2 ML / Live-Update (optional)

**Anforderung:** „Bei 10% Cost-Steigerung: EAC +15k€“ – Live-Aktualisierung in der UI (Phase 2 optional).

**Akzeptanzkriterien (optional):**
- Backend oder Frontend-Service schätzt bei Parameteränderung (z. B. Cost-Steigerung %) das EAC-Delta (regressionsbasiert oder aus Monte-Carlo-Cache).
- In Costbook/PMR-UI: kleines „What-If“-Feld mit Live-Aktualisierung der geschätzten Auswirkung.
- Kann in einer späteren Phase umgesetzt werden; in dieser Phase nur als Option in der Spec geführt.

---

## Abhängigkeiten und Risiken

- **Push:** Browser-Permission und Service Worker erfordern HTTPS; Permission-Flow muss getestet werden.
- **Root-Cause / Auto-Fix / Optimizer:** Können LLM-Aufrufe erfordern (Kosten, Latenz); regelbasierte Fallbacks werden empfohlen.
- **Semantic Search:** Falls kein Embedding-Service verfügbar, zuerst Intent-Mapping und Synonyme umsetzen.

---

## Referenzen

- VarianceAlerts: `app/dashboards/components/VarianceAlerts.tsx`
- VarianceAlertService: `backend/services/variance_alert_service.py`
- NL Parser / NLSearchInput: `lib/nl-query-parser.ts`, `components/costbook/NLSearchInput.tsx`
- RecommendationsPanel: `components/costbook/RecommendationsPanel.tsx`
- DistributionSettingsDialog: `components/costbook/DistributionSettingsDialog.tsx`
- HelpChatProvider / help_rag_agent: `app/providers/HelpChatProvider.tsx`, `backend/services/help_rag_agent.py`
- MonteCarloAnalysisComponent: `components/pmr/MonteCarloAnalysisComponent.tsx`
