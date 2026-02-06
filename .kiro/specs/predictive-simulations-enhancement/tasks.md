# Tasks: Predictive Simulations Enhancement

## Overview

Inkrementelle Implementierung der Predictive-Simulations-Erweiterung: zuerst Distribution Rules in Sim-Berechnungen, dann AI-Szenarien, Heatmap, Voice, zuletzt AR/Gamification/Sustainability (Phase 3).

**Abhängigkeiten:** Monte Carlo Engine, Distribution Engine (`lib/costbook/distribution-engine.ts`), `MonteCarloAnalysisComponent`, Scenarios API.

---

## Task 1: Erweitere Berechnungen mit Distribution Rules

**Ziel:** Forecast-Simulationen nutzen Distribution-Profil und Duration (linear/custom) aus Costbook/Cora-Doc.

- [x] **1.1** Distribution-Profil und Duration in Sim-Input übernehmen
  - API oder Kontext: Projekt-Distribution-Settings (profile, duration_start, duration_end, granularity) aus Costbook/Backend lesen.
  - In `MonteCarloAnalysisComponent` (oder Wrapper) optional Props/State für `distributionSettings`; Default linear über Projekt-Duration.
  - _Requirements: R-PS1_

- [x] **1.2** Forecast-Sim-Logik mit periodenweiser Verteilung erweitern
  - Backend oder Frontend: Bei Sim-Lauf `calculateDistribution` (oder Backend-Äquivalent) mit gleichen Settings aufrufen; periodenweise Cash-Out in Sim-Ergebnisse integrieren (z.B. „Spend pro Periode“, „Peak Cash“).
  - Sicherstellen, dass bestehende Percentile (P50, P90, Expected Cost) weiterhin aus der Monte-Carlo-Engine kommen; Distribution nur für Forecast-Anteil.
  - _Requirements: R-PS1_

- [x] **1.3** Slider/UI für Forecast-Profil und Duration im Sim-Widget
  - Slider oder Dropdown „Forecast-Profil“ (linear/custom); bei custom optional Duration From/To (oder Link „Im Costbook bearbeiten“).
  - Bei Änderung: Berechnung mit neuem Profil anstoßen (Live-Update optional, siehe Design: gecacht oder vereinfachtes Modell).
  - _Requirements: R-PS1_

- [x] **1.4** Checkpoint – Distribution in Sim
  - Tests: Projekt mit linearer Distribution → Sim-Output enthält erwartete periodenweise Anteile; Wechsel auf custom → andere Verteilung sichtbar.

---

## Task 2: AI-Generator für Szenarien

**Ziel:** 3–5 Szenarien basierend auf Trends vorschlagen; User kann übernehmen und Sim starten.

- [x] **2.1** Backend: Endpoint für Szenario-Vorschläge
  - z.B. `GET /api/v1/projects/{projectId}/simulations/ai-suggestions` (oder POST mit body).
  - Input: projectId, optional limit (default 5).
  - Output: Liste `{ id, name, description, params }` mit iterations, confidence_level, budget_uncertainty, schedule_uncertainty.
  - Logik: Aus Risiken/Historie Presets ableiten oder feste 3–5 Presets (Optimistic, Pessimistic, Baseline+10%, etc.).
  - _Requirements: R-PS2_

- [x] **2.2** Frontend: Button „AI-Szenarien vorschlagen“ und Anzeige
  - Aufruf des Endpoints; Anzeige als Karten oder Liste mit Name, Beschreibung.
  - Buttons „Übernehmen & Simulieren“ / „Nur übernehmen“ pro Vorschlag.
  - Fallback: Wenn Endpoint fehlschlägt, 3–5 feste Presets im Frontend anzeigen.
  - _Requirements: R-PS2_

- [x] **2.3** Übernahme: Parameter setzen und optional Sim starten
  - Bei „Übernehmen“: State/Params in MonteCarloAnalysisComponent setzen; bei „Simulieren“ zusätzlich `onRunSimulation` aufrufen.
  - _Requirements: R-PS2_

---

## Task 3: Heatmap-Komponente

**Ziel:** Multi-Scenario-Heatmap (Recharts oder Tabelle mit Farben), Click-to-Apply.

- [x] **3.1** Heatmap-Darstellung
  - Zeilen = Szenarien (Name), Spalten = P50 (Budget), P90 (Budget), Expected Cost, P50 (Schedule), optional CO2.
  - Recharts (Heatmap oder ResponsiveContainer + Zellen) oder Tabelle mit `td`-Hintergrundfarben (grün/rot relativ zu Baseline).
  - Legende: Grün = besser als Baseline, Rot = schlechter.
  - _Requirements: R-PS3_

- [x] **3.2** Farbberechnung relativ zu Baseline
  - Baseline = erstes Szenario oder explizit markiertes Szenario.
  - Pro Metrik: Abweichung in % oder absoluter Wert; Farbskala (z.B. grün wenn Cost niedriger, rot wenn höher).
  - _Requirements: R-PS3_

- [x] **3.3** Click-to-Apply
  - Klick auf Zeile oder „Apply“-Button pro Zeile → gewähltes Szenario als aktiv setzen (Parameter + ggf. Ergebnis laden).
  - Optional Bestätigungsdialog („Szenario X übernehmen?“).
  - _Requirements: R-PS3_

- [x] **3.4** Integration in MonteCarloAnalysisComponent
  - Abschnitt „Heatmap-Ansicht“ im Scenario-Comparison-Bereich (unter Side-by-Side-Tabelle oder als Tab).
  - Nur anzeigen wenn mindestens 2 Szenarien mit Ergebnissen.
  - _Requirements: R-PS3_

---

## Task 4: Voice-Input-Integration

**Ziel:** Mikrofon-Button im Sim-Bereich; Web Speech → Parser → Parameter setzen oder Szenario starten.

- [x] **4.1** Mikrofon-Button und Web Speech
  - Button im Sim-Parameter-Bereich; bei Klick Web Speech API starten, Transkript anzeigen.
  - Analog zu bestehender Voice-UI (DistributionSettingsDialog, HelpChat).
  - _Requirements: R-PS4_

- [x] **4.2** Parser für Sim-Befehle
  - Regex oder einfacher Parser für: „Set budget uncertainty 20“, „Set schedule uncertainty 15“, „Run optimistic scenario“, „Run simulation“.
  - Ausgabe: Aktion (set_param | run_scenario | run_simulation) + Werte.
  - _Requirements: R-PS4_

- [x] **4.3** Anbindung an Sim-Actions
  - Bei set_param: entsprechende State-Updates (budget_uncertainty, schedule_uncertainty).
  - Bei run_scenario: Szenario mit passendem Namen laden und Sim starten.
  - Bei run_simulation: Standard-Run auslösen.
  - Fehlermeldung bei unbekanntem Befehl.
  - _Requirements: R-PS4_

---

## Task 5: AR + Gamification + Sustainability (Phase 3)

**Ziel:** AR-Overlay (Spezifikation), Badge „Bestes Szenario“, CO2-Indikator pro Szenario.

- [x] **5.1** AR-Overlay (Spezifikation / Platzhalter)
  - Spezifikation: Kamera-Feed, OCR/Extraktion Backend, „In Sim verwenden“ (PO-Daten als Referenz).
  - Optional: Button „PO-Scan (Phase 3)“ im UI; Implementierung Phase 3.
  - _Requirements: R-PS5_

- [x] **5.2** Gamification: Badge „Bestes Szenario“
  - `lib/gamification-engine.ts`: Neuer Badge-Typ (z.B. `best_scenario`), Kontext um `bestScenarioChosen` / `scenariosBetterThanBaseline` erweitern.
  - Beim Speichern eines Szenarios: Prüfen ob Metrik (z.B. Expected Cost) besser als Baseline; wenn ja, Kontext setzen und Badge prüfen.
  - Badge in bestehender Gamification-UI anzeigen.
  - _Requirements: R-PS6_

- [x] **5.3** Sustainability: CO2-Indikator
  - Backend oder Frontend: Pro Szenario optional `co2_tco2e` berechnen (Heuristik: Faktoren × Dauer/Budget).
  - Konfiguration (Faktoren) pro Tenant oder App; wenn nicht konfiguriert, Spalte ausblenden oder „–“.
  - Anzeige: Spalte „CO2 (tCO2e)“ in Side-by-Side-Tabelle und in Heatmap.
  - _Requirements: R-PS7_

---

## Testbare Beispiele (Abnahme)

1. **Distribution in Sim:** Projekt mit linearer Distribution, Duration Jan–Dez. Slider „Custom 60/40 H1/H2“ → Sim-Output zeigt periodenweise Verteilung (z.B. in Tab oder Chart).
2. **AI-Szenarien:** „AI-Szenarien vorschlagen“ für Projekt X → 3–5 Einträge; Auswahl „Optimistic“ → Übernehmen & Simulieren → Sim läuft mit den vorgeschlagenen Parametern.
3. **Heatmap:** 3 Szenarien mit Ergebnissen; Heatmap mit 3 Zeilen, Spalten P50/P90/Expected; Baseline = Szenario A; B besser bei P90 → B-Zeile grün; Klick Apply auf B → aktives Szenario = B.
4. **Voice:** „Set budget uncertainty to 15“ → Slider Budget-Unsicherheit = 15%; „Run optimistic“ → (wenn Szenario „Optimistic“ existiert) Sim für dieses Szenario starten.
5. **Badge:** User wählt und speichert Szenario mit besserem Expected Cost als Baseline → Badge „Bestes Szenario“ erscheint (nach Erweiterung Engine).
6. **CO2:** Szenario mit längerer Dauer/höherem Budget → CO2-Spalte zeigt höheren Wert als Baseline (bei konfigurierter Heuristik).

---

## Checkpoints

- **Nach Task 1:** Distribution in Sim berechnet; Slider/UI bedienbar; Tests grün.
- **Nach Task 2:** AI-Vorschläge abrufbar; Übernahme + Sim funktioniert.
- **Nach Task 3:** Heatmap sichtbar; Click-to-Apply übernimmt Szenario.
- **Nach Task 4:** Voice-Befehle setzen Parameter bzw. starten Szenario.
- **Nach Task 5:** Badge und CO2 optional nutzbar; AR als Spec/Platzhalter.
