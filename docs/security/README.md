# Security Documentation

Dieser Ordner enthält die Sicherheitsdokumentation für Orka PPM.

**Aktualität:** Diese Docs bei Änderungen an Auth, JWT, Env-Variablen, RLS oder sicherheitskritischen APIs anpassen. Siehe auch [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md) vor jedem Production-Deploy.

## Dokumente

| Dokument | Inhalt |
|----------|--------|
| [vulnerability-analysis.md](vulnerability-analysis.md) | Analyse identifizierter Schwachstellen (JWT, IDOR, XSS, etc.) und umgesetzte Mitigations. |
| [env-setup.md](env-setup.md) | Konfiguration von `SUPABASE_JWT_SECRET` (Backend + Next.js) und optional `ALLOW_DEV_DEFAULT_USER` für sicheres Auth-Setup. |

## Kurzüberblick

- **JWT:** Backend und Next.js API-Routen verifizieren Bearer-Tokens mit `SUPABASE_JWT_SECRET` (Supabase Project Settings → API → JWT Secret). Ohne gesetztes Secret werden Tokens nur dekodiert (unsicher).
- **IDOR-Schutz:** Sync- und user-scoped APIs prüfen, dass die `userId` in Request mit der aus dem Token übereinstimmt.
- **Env:** Siehe [env-setup.md](env-setup.md) für exakte Schritte.

Vgl. auch [../SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md) für die Production-Checkliste.
