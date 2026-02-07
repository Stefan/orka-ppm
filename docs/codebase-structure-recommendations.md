# Empfehlungen: Thematische Unterverzeichnisse

Vorschläge zur besseren Strukturierung von Verzeichnissen mit vielen Dateien durch thematische Unterordner. Siehe auch [codebase-structure-and-refactor-backlog.md](codebase-structure-and-refactor-backlog.md).

---

## 1. `components/costbook/` (~50 Dateien, flach)

**Aktuell:** Alle Komponenten in einer Ebene (Costbook.tsx, VarianceWaterfall.tsx, NLSearchInput.tsx, …).

**Vorschlag – thematische Unterordner:**

| Unterordner   | Inhalt (Beispiele) |
|---------------|---------------------|
| `charts/`     | VarianceWaterfall, HealthBubbleChart, TrendSparkline, EVMTrendChart, RundownSparkline, CashOutGantt |
| `dialogs/`    | AnomalyDetailDialog, CSVImportDialog, DistributionSettingsDialog, PerformanceDialog, HelpDialog |
| `layout/`     | CostbookHeader, CostbookFooter, CollapsiblePanel, TransactionFilters |
| `tables/`     | VirtualizedTransactionTable, HierarchyTreeView |
| `ai/`         | NLSearchInput, SearchSuggestions, AnomalyIndicator, RecommendationsPanel, AIImportBuilder |
| `distribution/` | DistributionPreview, DistributionRulesPanel |
| `shared/`     | LoadingSpinner, ErrorDisplay, CostbookErrorBoundary, CurrencySelector, SyncStatusIndicator |

**Hinweis:** `components/costbook/index.ts` re-exportiert alles. Nach Verschiebung Pfade in `index.ts` anpassen (z. B. `./charts/VarianceWaterfall`) und ggf. Imports in anderen Dateien, die direkt aus Unterpfaden importieren.

**Aufwand:** Mittel (viele Imports prüfen).

---

## 2. `components/pmr/` (~53 Dateien)

**Aktuell:** Bereits `sections/` vorhanden; viele Dateien in der Wurzel (PMRChart, PMREditor, MonteCarloAnalysisComponent, …).

**Vorschlag – weitere Gruppierung:**

| Unterordner   | Inhalt (Beispiele) |
|---------------|---------------------|
| `sections/`   | (bereits vorhanden) |
| `charts/`     | PMRChart, pmr-chart-utils.ts |
| `editor/`     | PMREditor, ResponsivePMREditor, MobilePMREditor, LazyPMRSection |
| `templates/`  | PMRTemplateSelector, PMRTemplatePreview, PMRTemplateCustomizer, PMRTemplateSystemDemo |
| `monte-carlo/`| MonteCarloAnalysisComponent, ScenarioHeatmap, DistributionParamsBlock, VoiceSimButton |
| `collaboration/` | CollaborationPanel, MobileCollaborationPanel, CursorTracker, ConflictResolutionModal |
| `docs/`       | *.README.md, *.IMPLEMENTATION_SUMMARY.md, COLLABORATION.md (oder in Projektroot-Docs verschieben) |

**Aufwand:** Mittel.

---

## 3. `components/ui/` (~58 Dateien)

**Aktuell:** Bereits `atoms/`, `molecules/`, `organisms/`, `skeletons/`; zusätzlich viele Dateien in der Wurzel (Button, Card, Modal, VirtualizedList, …).

**Vorschlag:** Wurzel-Dateien thematisch zuordnen:

| Ziel (bestehend oder neu) | Zusätzliche Dateien aus Wurzel |
|---------------------------|--------------------------------|
| `atoms/`                  | Button, Input, Checkbox, Label (falls noch nicht drin), badge, switch |
| `molecules/`              | FormField, InputGroup, Modal, Select, Table |
| `organisms/`              | VirtualizedList, VirtualizedProjectList, VirtualizedResourceTable, GuidedWorkflow |
| `feedback/` (neu)        | ErrorMessage, ProgressIndicator, Skeleton, NetworkAwareLoader |
| `layout/` (neu)          | ContentReservoir, LayoutStabilizer, CLSSafeContainer |

Barrel-Export in `components/ui/index.ts` anpassen.

**Aufwand:** Mittel.

---

## 4. `lib/` (Wurzel: viele einzelne .ts)

**Aktuell:** Neben Ordnern (api/, costbook/, i18n/, …) viele flache Dateien: api.ts, comments-service.ts, costbook-*.ts, evm-calculations.ts, gamification-engine.ts, etc.

**Vorschlag – thematische Bündel:**

| Unterordner     | Dateien (Beispiele) |
|-----------------|----------------------|
| `api/`          | (bereits vorhanden); ggf. `api.ts` (Legacy) hier als `legacy.ts` oder dokumentiert lassen |
| `costbook/`     | (bereits vorhanden); Root-Dateien costbook-calculations.ts, costbook-feature-flags.ts, cost-estimate-history.ts nach `costbook/` verschieben |
| `calculations/` (neu) | evm-calculations.ts, predictive-calculations.ts, costbook-calculations.ts (falls nicht in costbook/) |
| `ppm/` (neu)    | pmr-api.ts, pmr-help-content.ts, recommendation-engine.ts, gamification-engine.ts, rundown-*.ts (PMR/Portfolio-Logik) |
| `services/`     | (bereits vorhanden); comments-service.ts, screenshot-service.ts (Root) hierher oder in services/ belassen und Root-Duplikat entfernen |

**Aufwand:** Niedrig bis Mittel (Imports prüfen).

---

## 5. `lib/utils/` (24 Dateien, flach)

**Aktuell:** Alles in einer Ebene (chrome-*, browser-detection, scroll-performance, error-handler, …).

**Vorschlag:**

| Unterordner   | Dateien |
|---------------|---------|
| `browser/`   | browser-detection.ts, chrome-*.ts (chrome-css-validation, chrome-detection-optimization, chrome-scroll-*, chrome-scroll-integration-example) |
| `performance/` | scroll-performance.ts, performance-optimization.ts, resource-preloader.ts, code-splitting.ts |
| `design/`    | design-system.ts |
| (Wurzel)      | env.ts, error-handler.ts, formatting.ts, cache-manager.ts, deprecated-api-detector.ts, polyfill-loader.ts, progressive-enhancement.ts, touch-handler.ts, web-workers.ts |

`lib/utils/index.ts` müsste Re-Exports aus den Unterordnern bereitstellen, damit bestehende Imports (z. B. `@/lib/utils/chrome-scroll-performance`) weiter funktionieren.

**Aufwand:** Mittel (viele Imports auf spezifische Pfade).

---

## 6. `backend/routers/` (50+ .py-Dateien, flach)

**Aktuell:** Alle Router als einzelne Module (admin.py, audit.py, change_orders.py, change_approvals.py, …).

**Vorschlag – thematische Pakete:**

| Unterordner   | Router (Beispiele) |
|---------------|----------------------|
| `admin/`      | (bereits knowledge.py); admin.py, admin_performance.py, feature_flags.py, feature_toggles.py, users.py, rbac.py |
| `change/`     | change_orders.py, change_approvals.py, change_analytics.py, change_management.py, change_management_simple.py, contract_integration.py |
| `help/`       | help_chat.py, help_chat_enhanced.py, help_content_management.py, visual_guides.py |
| `pmr/`        | enhanced_pmr.py, pmr_performance.py |
| `project/`    | projects.py, projects_import.py, project_controls.py, portfolios.py |
| `financial/`  | financial.py, earned_value.py, variance.py, forecasts.py, csv_import.py |
| (Wurzel)      | main.py-relevante Einstiege; restliche Router (ai, audit, reports, schedules, workflows, …) je nach Bedarf gruppieren |

**Migration:** Pro Paket `routers/<paket>/__init__.py` anlegen und Router aus dem Paket re-exportieren; in `main.py` von `from routers.<paket>.<modul> import router as ...` auf die neuen Pfade umstellen. Tests, die `from routers.change_approvals import ...` nutzen, auf `from routers.change.change_approvals import ...` umstellen.

**Aufwand:** Hoch (main.py + alle Tests/Imports).

---

## 7. `backend/services/` (90+ .py-Dateien, flach)

**Aktuell:** Sehr viele Services in einer Ebene (audit_*.py, change_*.py, workflow_*.py, help_*.py, …).

**Vorschlag – thematische Pakete:**

| Unterordner   | Services (Beispiele) |
|---------------|-----------------------|
| `audit/`      | audit_service.py, audit_ml_service.py, audit_export_service.py, audit_scheduled_jobs.py, audit_*.py |
| `change/`     | change_order_*.py, change_integration_service.py, change_request_manager.py, change_template_service.py, change_analytics_service.py, approval_workflow_engine.py |
| `workflow/`   | workflow_*.py (workflow_engine_core, workflow_analytics_service, workflow_batch_processor, …) |
| `help/`       | help_chat_*.py, help_documentation_rag.py, help_rag_agent.py, proactive_tips_engine.py |
| `pmr/`        | enhanced_pmr_service*.py, pmr_*.py |
| `schedule/`   | schedule_manager.py, schedule_audit_service.py, schedule_cache.py, schedule_financial_integration.py, resource_assignment_service.py |
| `financial/`  | financial_integration_service.py, cost_impact_analyzer_service.py, eac_calculator_service.py, etc_calculator_service.py, earned_value_manager_service.py |
| `integration/`| project_integration_service.py, contract_integration_manager_service.py, data_integrity_service.py |

Jedes Paket mit `__init__.py` und Re-Export der öffentlichen Services; bestehende Imports `from services.xyz import ...` auf `from services.<paket>.xyz import ...` (oder Re-Export in `services/__init__.py`) umstellen.

**Aufwand:** Hoch.

---

## 8. `__tests__/` (viele flache Dateien im Root)

**Aktuell:** Neben Unterordnern (api-routes/, register-nested-grids/, unit/, property/, …) viele Tests direkt unter `__tests__/` (z. B. admin-*.test.tsx, button-*.property.test.tsx, costbook-*.test.ts).

**Vorschlag:**

| Aktion | Beschreibung |
|--------|--------------|
| Property-Tests in `property/` | Alle `*.property.test.ts(x)` aus der Root in `__tests__/property/` verschieben (einige liegen schon dort). |
| Unit-Tests in `unit/` | Einheitliche Tests (z. B. evm-calculations.test.ts, nl-query-parser.test.ts) in `__tests__/unit/` verschieben. |
| Domain-Tests | Tests wie costbook-*.test.ts, costbook-*.property.test.ts in `__tests__/costbook/` (neu) oder bei `__tests__/lib/` belassen. |

**Hinweis:** `jest.config.js` enthält teils konkrete `testPathIgnorePatterns` mit Dateinamen; bei Verschiebung diese Pfade anpassen.

**Aufwand:** Niedrig bis Mittel.

---

## Priorisierung

| Priorität | Bereich | Begründung |
|-----------|---------|------------|
| 1 (niedrig Risiko) | `__tests__/` in property/ und unit/ sortieren | Keine Produktions-Imports; bessere Auffindbarkeit. |
| 2 | `backend/routers/` in change/, admin/, help/ gruppieren | Klarere Struktur; viele Router. |
| 3 | `lib/utils/` in browser/, performance/ gruppieren | Klare Themen; Index-Re-Export erhält Kompatibilität. |
| 4 | `components/costbook/` in charts/, dialogs/, ai/, … | Größter Gewinn für Lesbarkeit; mehr Anpassungen. |
| 5 | `backend/services/` in audit/, change/, workflow/, … | Sehr viele Dateien; Aufwand hoch. |

---

## Nächste Schritte

1. **Sofort:** In [__tests__/README.md](../__tests__/README.md) festhalten, dass neue Property-Tests in `property/`, neue Unit-Tests in `unit/` liegen sollen.
2. **Optional:** Eine der vorgeschlagenen Strukturierungen schrittweise umsetzen (z. B. zuerst `backend/routers/change/` oder `__tests__/` Root aufräumen).
3. Bei jeder Verschiebung: Imports und Barrel-Exports anpassen, CI/Tests laufen lassen.

## Umgesetzt (Stand)

| Bereich | Status |
|---------|--------|
| `backend/routers/change/` | ✅ Erledigt (change_orders, change_approvals, change_analytics, …) |
| `__tests__/` Root → property/ + unit/ | ✅ Root-Property-Tests nach `__tests__/property/` verschoben; Unit-Tests (evm-calculations, nl-query-parser, …) nach `__tests__/unit/`. Relative Imports in property-Tests auf `../../` angepasst. |
| `lib/utils/` → browser/, performance/, design/ | ✅ Unterordner angelegt, Dateien verschoben; Re-Export-Dateien an alter Stelle für Kompatibilität (`@/lib/utils/chrome-scroll-performance` etc.). |

*Stand: Februar 2025.*
