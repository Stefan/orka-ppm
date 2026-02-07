# Audit Trail: Enterprise-Weiterentwicklung & Prioritäten

Orientierung an den [AI-Empowered Audit Trail Requirements](.kiro/specs/ai-empowered-audit-trail/requirements.md) und Best Practices für Enterprise-Audit (FDA 21 CFR Part 11, GDPR, SOC 2).

---

## Was bereits steht

- **Backend:** Schema (audit_logs, embeddings, anomalies, ML-Modelle), Anomaly Detection, RAG/Semantic Search, ML-Klassifikation, Export (PDF/CSV), Integration Hub, Encryption, Compliance-Service, Bias Detection, Scheduler
- **Frontend:** Audit-Dashboard (Stats), Timeline, Anomaly-Dashboard, Semantic Search (NL), Filter (AuditFilters)
- **API:** `/api/audit/logs`, `/api/audit/dashboard/stats`, `/api/audit/search`, `/api/audit/detect-anomalies`, Export, Tagging, Anomaly-Feedback

---

## Enterprise-Essentials (Priorität 1)

Diese Punkte sind für „Enterprise-grade“ und Compliance typischerweise unverzichtbar.

### 1. Unveränderbarkeit & Integrität (Req 6)

| Thema | Status / Lücke | Empfehlung |
|-------|-----------------|------------|
| Append-only | Backend: keine UPDATE/DELETE auf audit_logs | DB-Trigger/RLS prüfen, dass nur INSERT erlaubt ist; in Tests abgesichert lassen |
| Hash-Chain | Schema: hash, previous_hash vorhanden | Sicherstellen, dass bei jedem neuen Event Hash aus vorherigem Event berechnet und gespeichert wird; Verifikation bei Abfrage optional anbieten |
| Integritätsprüfung | — | Job/Endpoint „Verify hash chain“ (z. B. täglich), bei Bruch Alert + Log |
| Zugriff auf Logs protokollieren | Req 6.9 | Jeden Lesezugriff auf Audit-Daten (wer, wann, welche Filter/Export) in separater access_log Tabelle oder in audit_logs als „audit_access“-Event schreiben |

### 2. Retention & Archivierung (Req 6.10, 6.11)

| Thema | Empfehlung |
|-------|------------|
| Mindestaufbewahrung | Retention Policy konfigurierbar (z. B. 7 Jahre), dokumentiert |
| Archivierung | Events älter als X (z. B. 1 Jahr) in Cold Storage (andere Tabelle, S3, Archiv-DB); Abfragen/Export weiter möglich (mit Hinweis „archiviert“) |
| Löschung nach Retention | Nur nach Ablauf der Retention und nur als definierter Prozess (z. B. anonymisieren/löschen mit eigenem Audit-Eintrag) |

### 3. Berechtigungen & Tenant-Isolation (Req 6.7, 6.8, 9)

| Thema | Empfehlung |
|-------|------------|
| audit:read / audit:export | Bereits vorgesehen; alle Audit-Endpoints konsequent prüfen (inkl. Export, Search, Timeline, Dashboard) |
| Tenant-Isolation | Alle Queries strikt nach tenant_id filtern; RLS auf audit_logs (und zugehörigen Tabellen) aktiv und getestet |
| Admin-/Auditor-Rollen | Klar definieren: Wer darf nur lesen, wer exportieren, wer Konfiguration (Anomaly-Schwellen, Integrationen) ändern |

### 4. Echte Event-Quellen (Logging überall)

| Thema | Empfehlung |
|-------|------------|
| Zentrale Erfassung | Alle relevanten Aktionen (Login, Projekt-/Budget-/Ressourcen-/Berechtigungsänderungen, Exporte, Konfiguration) in ein einheitliches Audit-Event-Format schreiben |
| Backend | Bestehende Services (z. B. audit_service, generic_audit_service) an zentraler Stelle aufrufen; neue Features von Anfang an anbinden |
| Frontend | Kritische Aktionen (z. B. „Export“, „Bulk-Änderung“) per API an Backend melden, Backend schreibt Event |

Ohne flächendeckendes Logging ist das Audit Trail für Enterprise und Prüfer nur begrenzt aussagekräftig.

---

## Wichtige Erweiterungen (Priorität 2)

### 5. Real-Time & Dashboard (Req 10)

- Event-Zahlen und „letzte Anomalien“ im Dashboard alle 30–60 s aktualisieren (Polling oder WebSocket).
- Bei kritischen Anomalien optional Browser-Notification oder Badge im UI.

### 6. Export & Nachweisbarkeit

- PDF/CSV mit festem Format (inkl. Zeitstempel, Tenant, Filter, ggf. Hash/Integritätshinweis).
- Optional: Export-Events selbst im Audit Trail protokollieren (wer, wann, welcher Export).

### 7. Anomalie-Feedback & Tuning

- False-Positive/Negative-Feedback wie vorgesehen speichern und für Re-Training/Anpassung der Schwellen nutzen.
- Konfigurierbare Schwellen (z. B. Anomaly-Score > 0.7) pro Tenant oder global.

### 8. Integrationen (Req 5)

- Webhooks (Zapier), Slack, Teams bei Anomalien oder kritischen Events; Konfiguration nur für berechtigte Rollen.
- Credentials/URLs verschlüsselt speichern (audit_encryption_service), Zugriff loggen.

---

## Nice-to-have (Priorität 3)

- **Bias-Reports (Req 8):** Monatliche Auswertung nach Rolle/Abteilung/Entity; Alerts bei starker Abweichung.
- **Erklärbarkeit:** Pro Anomalie kurze Begründung (welche Features beigetragen haben).
- **Scheduled Reports:** Tägliche/Wöchentliche E-Mail mit AI-Summary; Konfiguration pro Tenant/Rolle.

---

## Konkrete nächste Schritte (Vorschlag)

1. ~~**Integrität:** Hash-Chain bei jedem neuen Event befüllen und Verifikations-Job/Endpoint implementieren; bei Bruch Alert.~~ ✅
2. ~~**Access-Logging:** Jeden Lesezugriff auf Audit-Daten (inkl. Export) protokollieren (Req 6.9).~~ ✅
3. ~~**Retention & Archiv:** Policy definieren, Archivierung (Cold Storage) und Abfrage „archivierte Events“ umsetzen.~~ ✅ (Basis)
4. **Logging-Abdeckung:** Liste aller „kritischen“ Aktionen erstellen; fehlende Stellen im Backend (und ggf. Frontend) schließen.
5. **Real-Time:** Dashboard-Stats und Anomalien per Polling oder WebSocket aktualisieren.

---

## Umsetzung (Stand)

Folgende Punkte wurden umgesetzt:

- **Hash-Chain (Req 6):** Bei Batch-Insert (`POST /api/audit/events/batch`), bei `log_audit_access` und beim Tagging wird für jedes Event `previous_hash` und `hash` über `AuditComplianceService` berechnet und gespeichert. `get_latest_audit_hash` und `verify_hash_chain` unterstützen `tenant_id` als String (z. B. `"default"`).
- **Verify-Integrität:** `GET /api/audit/verify-integrity` (mit `audit:read`) führt die Hash-Ketten-Prüfung für den aktuellen Tenant aus. Bei Bruch: Critical-Log und Eintrag in `audit_integrity_alerts`. Zusätzlich: `AuditScheduledJobs.run_hash_chain_verification()` für täglichen Job (z. B. Scheduler).
- **Access-Logging (Req 6.9):** Einheitliche Funktion `log_audit_access(user_id, tenant_id, action, filters)` schreibt `audit_access`-Events in `audit_logs` (mit Hash-Chain). Aufruf an: GET /events, GET /timeline, POST /search, GET /logs, Export (PDF/CSV/JSON), POST /detect-anomalies, POST /search-logs.
- **Retention & Archiv:** Migration `052_audit_retention_archived_at.sql` fügt `archived_at` zu `audit_logs` hinzu. `GET /api/audit/logs` unterstützt `include_archived=false` (nur aktive) und `archive_only=true` (nur archivierte). Retention-Policy: z. B. Umgebungsvariable `AUDIT_RETENTION_YEARS=7` für Mindestaufbewahrung (Jahre); konfigurierbar, Anwendung im Archiv-/Cold-Storage-Job optional.

---

## Referenzen

- Requirements: `.kiro/specs/ai-empowered-audit-trail/requirements.md`
- Tasks/Phasen: `.kiro/specs/ai-empowered-audit-trail/tasks.md`
- Backend: `backend/routers/audit.py`, `backend/services/audit_*.py`
- Frontend: `app/audit/page.tsx`, `components/audit/` (Timeline, SemanticSearch, AnomalyDashboard, AuditFilters)
