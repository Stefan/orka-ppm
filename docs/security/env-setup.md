# JWT & Auth env setup

Damit die JWT-Verifikation und der IDOR-Schutz greifen, müssen folgende Variablen gesetzt werden.

---

## Backend (`backend/.env` oder `.env` im Backend-Root)

1. **SUPABASE_JWT_SECRET** (empfohlen für Produktion und sicheres Dev)
   - Wert: **JWT Secret** aus Supabase: **Project Settings → API → JWT Secret** (nicht Anon Key, nicht Service Role Key).
   - Ohne diesen Wert werden Tokens nur dekodiert, nicht signaturgeprüft (unsicher).

2. **ALLOW_DEV_DEFAULT_USER** (nur für lokales Dev ohne echte Tokens)
   - Optional: `ALLOW_DEV_DEFAULT_USER=true`
   - Nur wirksam, wenn die Umgebung `development` ist.
   - Erlaubt Zugriff ohne Token mit einem Default-Admin; **niemals in Produktion setzen**.

---

## Next.js (`.env.local` im Projektroot)

1. **SUPABASE_JWT_SECRET**
   - **Gleicher Wert** wie im Backend (JWT Secret aus Supabase Project Settings → API).
   - Wird nur in API-Routen (Server) verwendet; **nicht** mit `NEXT_PUBLIC_` prefix.

Damit können die Next.js API-Routen (Sync, Column-Views, Suggest-Description, Quick-Stats usw.) Bearer-Tokens verifizieren und die User-ID sicher aus dem Token ableiten.

---

## Kurzreferenz

| Variable | Wo | Wert |
|----------|-----|-----|
| `SUPABASE_JWT_SECRET` | Backend `.env` + Next.js `.env.local` | Supabase Dashboard → Project Settings → API → JWT Secret |
| `ALLOW_DEV_DEFAULT_USER` | Backend `.env` (optional) | `true` nur für lokales Dev ohne echte Tokens |
