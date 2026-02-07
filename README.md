# ORKA PPM

AI-powered Project Portfolio Management (PPM) – Full-stack SaaS for portfolio dashboards, resource planning, risk simulations, financial tracking, change management, and audit.

## Zielgruppe

PMOs, Projekt- und Portfolio-Manager, Ressourcenplaner in mittelständischen und Enterprise-Umgebungen.

## Tech-Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React
- **Backend:** Python (FastAPI), PostgreSQL (Supabase)
- **Auth:** Supabase Auth (JWT)
- **Features:** Monte-Carlo-Simulationen, Audit Trail, Help-Chat (RAG), Workflows, i18n

## Voraussetzungen

- Node.js 18+
- npm oder pnpm
- Python 3.10+ (für Backend)
- Supabase-Projekt (URL + Anon Key + ggf. Service Role / JWT Secret)

## Lokal starten

1. **Repository klonen und Abhängigkeiten installieren**
   ```bash
   npm install
   ```

2. **Umgebungsvariablen**
   - `.env.local.example` nach `.env.local` kopieren und Werte eintragen (Supabase, Backend-URL).
   - Siehe [docs/security/env-setup.md](docs/security/env-setup.md) für JWT und optionale Backend-Variablen.

3. **Frontend (Next.js)**
   ```bash
   npm run dev
   ```
   App: [http://localhost:3000](http://localhost:3000)

4. **Backend (optional, für volle API-Funktionalität)**
   ```bash
   npm run dev:backend
   ```
   Backend: [http://localhost:8000](http://localhost:8000)  
   Oder siehe `backend/README.md` bzw. `start-local.sh`.

## Wichtige Skripte

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Next.js Dev-Server (Port 3000) |
| `npm run build` | Production-Build |
| `npm run test` | Jest-Tests |
| `npm run test:regression` | Nur Regression-Tests |
| `npm run lint` | ESLint |

## Dokumentation

- **Überblick:** [docs/README.md](docs/README.md)
- **Struktur & Setup:** [docs/frontend/PROJECT_OVERVIEW.md](docs/frontend/PROJECT_OVERVIEW.md)
- **Marktreife-Roadmap:** [docs/MARKET_READINESS_ROADMAP.md](docs/MARKET_READINESS_ROADMAP.md)
- **Security/Env:** [docs/security/env-setup.md](docs/security/env-setup.md)
