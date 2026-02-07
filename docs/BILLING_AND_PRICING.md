# Billing und Abrechnung

Diese Dokumentation beschreibt die Entscheidung und den Stand zu Billing/Abrechnung für die PPM-SaaS-Anwendung (Marktreife-Roadmap Phase 3.2).

## Entscheidung

- **Aktuell:** **Manuelle Rechnungsstellung.** Es gibt keine Self-Serve-Kaufabwicklung (kein Stripe/Shop im Produkt). Abrechnung und Verträge werden außerhalb der App (z. B. per E-Mail, ERP, manuelle Rechnungen) abgewickelt.
- **Organisationen/Tenants:** Die Verwaltung von Organisationen (Tenants) erfolgt über den Super-Admin-Bereich (`/admin/organizations`). Pro Organisation können in `organizations.settings` (JSONB) optionale Felder wie `plan`, `limits`, `billing_id` hinterlegt werden – für interne Zuordnung und spätere Automatisierung.

## Option: Self-Serve (zukünftig)

Falls später Self-Serve gewünscht wird:

1. **Pläne und Limits**  
   In `organizations.settings` oder einer eigenen Tabelle: Plan (z. B. Starter/Pro/Enterprise), Nutzer-Limit, Projekt-Limit, Feature-Flags.

2. **Stripe (oder anderer Anbieter)**  
   - Checkout Session für Abo-Abschluss  
   - Webhook für Zahlungsstatus / Abo-Status → Update `organizations.settings` oder Abo-Tabelle  
   - Frontend: Plan-Auswahl, Upgrade-Flow, ggf. Anzeige von Nutzer-/Projekt-Limits

3. **Backend-Logik**  
   Bei Projekt-Erstellung, User-Invite usw.: Prüfung der Limits des aktuellen Tenants anhand `organizations.settings` oder Abo-Daten.

## Referenzen

- Roadmap: [MARKET_READINESS_ROADMAP.md](MARKET_READINESS_ROADMAP.md) Phase 3.2  
- Tenant-Spec: [.kiro/specs/saas-tenant-management/requirements.md](../.kiro/specs/saas-tenant-management/requirements.md)
